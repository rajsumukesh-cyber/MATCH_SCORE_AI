/**
 * Server-only payment orchestration for x402 micropayments.
 */
import type { AppSupabase } from "./db.server";
import { writeAudit } from "./db.server";
import {
  buildRequirements,
  getX402Config,
  settlePayment,
  validatePayloadShape,
  verifyPayment,
} from "./x402.server";
import {
  PRODUCT_LABELS,
  X402_VERSION,
  decodePaymentHeader,
  type ProductCode,
  type X402PaymentRequirements,
  type X402Quote,
} from "./x402";

export async function getPrice(supabase: AppSupabase, product: ProductCode): Promise<number> {
  const { data, error } = await supabase
    .from("pricing")
    .select("price_usd, active")
    .eq("product", product)
    .maybeSingle();
  if (error || !data) throw new Error("That product is not available.");
  if (!data.active) throw new Error("That product is currently disabled.");
  return Number(data.price_usd);
}

/** Create a pending payment row and the matching x402 requirements. */
/** On-chain x402 is only possible when a receiving wallet is configured. */
function tryX402Config() {
  try {
    return getX402Config();
  } catch {
    return null;
  }
}

export function getPaymentMode(): { mode: "onchain" | "sandbox"; network: string } {
  const config = tryX402Config();
  return config
    ? { mode: "onchain", network: config.network }
    : { mode: "sandbox", network: "sandbox" };
}

export async function createQuote(
  supabase: AppSupabase,
  userId: string,
  product: ProductCode,
): Promise<X402Quote> {
  const config = tryX402Config();
  const priceUsd = await getPrice(supabase, product);

  if (!config) return createSandboxQuote(userId, product, priceUsd);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin
    .from("payments")
    .insert({
      user_id: userId,
      product,
      amount_usd: priceUsd,
      status: "pending",
      network: config.network,
      pay_to: config.payTo,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[payments] failed to create quote", error?.message);
    throw new Error("Could not start the payment. Please try again.");
  }

  const requirements = buildRequirements({
    config,
    priceUsd,
    product,
    resource: `x402://matchscore/${product}/${data.id}`,
    description: `${PRODUCT_LABELS[product]} — MatchScore`,
  });

  await supabaseAdmin.from("payments").update({ asset: requirements.asset }).eq("id", data.id);

  return {
    x402Version: X402_VERSION,
    accepts: [requirements],
    product,
    priceUsd,
    paymentId: data.id,
    mode: "onchain",
  };
}

/**
 * Sandbox quote: used when no receiving wallet is configured yet, so the
 * product stays usable end-to-end without an on-chain settlement.
 */
async function createSandboxQuote(
  userId: string,
  product: ProductCode,
  priceUsd: number,
): Promise<X402Quote> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("payments")
    .insert({
      user_id: userId,
      product,
      amount_usd: priceUsd,
      status: "pending",
      network: "sandbox",
      payload: { sandbox: true } as never,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[payments] failed to create sandbox quote", error?.message);
    throw new Error("Could not start the payment. Please try again.");
  }

  return {
    x402Version: X402_VERSION,
    accepts: [],
    product,
    priceUsd,
    paymentId: data.id,
    mode: "sandbox",
  };
}

/** Settle a sandbox payment (no wallet, no chain) so the report can run. */
export async function settleSandbox(args: {
  userId: string;
  paymentId: string;
}): Promise<SettleResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin
    .from("payments")
    .select("id, user_id, amount_usd, status, receipt_code, network")
    .eq("id", args.paymentId)
    .maybeSingle();

  if (error || !row) throw new Error("Payment not found.");
  if (row.user_id !== args.userId) throw new Error("Payment does not belong to you.");
  if (row.network !== "sandbox") throw new Error("This payment requires a wallet signature.");

  if (row.status === "pending") {
    await supabaseAdmin.from("payments").update({ status: "settled" }).eq("id", row.id);
    await writeAudit({
      userId: args.userId,
      action: "payment.settled",
      entity: "payment",
      entityId: row.id,
      metadata: { sandbox: true },
    });
  }

  return {
    paymentId: row.id,
    status: "settled",
    txHash: null,
    receiptCode: row.receipt_code,
    network: "sandbox",
    amountUsd: Number(row.amount_usd),
    payer: null,
  };
}

function rebuildRequirements(row: {
  id: string;
  product: ProductCode;
  amount_usd: number | string;
}): X402PaymentRequirements {
  const config = getX402Config();
  return buildRequirements({
    config,
    priceUsd: Number(row.amount_usd),
    product: row.product,
    resource: `x402://matchscore/${row.product}/${row.id}`,
    description: `${PRODUCT_LABELS[row.product]} — MatchScore`,
  });
}

export interface SettleResult {
  paymentId: string;
  status: "settled";
  txHash: string | null;
  receiptCode: string;
  network: string;
  amountUsd: number;
  payer: string | null;
}

/** Verify then settle a signed x402 payment header against a pending payment. */
export async function verifyAndSettle(args: {
  userId: string;
  paymentId: string;
  paymentHeader: string;
}): Promise<SettleResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: row, error } = await supabaseAdmin
    .from("payments")
    .select("id, user_id, product, amount_usd, status, receipt_code")
    .eq("id", args.paymentId)
    .maybeSingle();

  if (error || !row) throw new Error("Payment not found.");
  if (row.user_id !== args.userId) throw new Error("Payment does not belong to you.");
  if (row.status === "settled" || row.status === "consumed") {
    return {
      paymentId: row.id,
      status: "settled",
      txHash: null,
      receiptCode: row.receipt_code,
      network: getX402Config().network,
      amountUsd: Number(row.amount_usd),
      payer: null,
    };
  }
  if (row.status !== "pending") throw new Error("This payment can no longer be completed.");

  const requirements = rebuildRequirements(row as never);
  const config = getX402Config();

  const fail = async (reason: string): Promise<never> => {
    await supabaseAdmin
      .from("payments")
      .update({ status: "failed", failure_reason: reason })
      .eq("id", row.id);
    await writeAudit({
      userId: args.userId,
      action: "payment.failed",
      entity: "payment",
      entityId: row.id,
      metadata: { reason },
    });
    throw new Error(reason);
  };

  let payload;
  try {
    payload = decodePaymentHeader(args.paymentHeader);
  } catch {
    return fail("The payment header could not be read.");
  }

  const shapeError = validatePayloadShape(payload, requirements);
  if (shapeError) return fail(shapeError);

  const verified = await verifyPayment(config, payload, requirements);
  if (!verified.valid) return fail(verified.reason ?? "Payment verification failed.");

  const settled = await settlePayment(config, payload, requirements);
  if (!settled.settled) return fail(settled.reason ?? "Payment settlement failed.");

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("payments")
    .update({
      status: "settled",
      tx_hash: settled.txHash ?? null,
      payer: settled.payer ?? verified.payer ?? null,
      payload: { authorization: payload.payload.authorization } as never,
    })
    .eq("id", row.id)
    .select("receipt_code, amount_usd")
    .single();

  if (updateError) {
    console.error("[payments] settled but failed to persist", updateError.message);
  }

  await writeAudit({
    userId: args.userId,
    action: "payment.settled",
    entity: "payment",
    entityId: row.id,
    metadata: { txHash: settled.txHash, product: row.product },
  });

  return {
    paymentId: row.id,
    status: "settled",
    txHash: settled.txHash ?? null,
    receiptCode: updated?.receipt_code ?? row.receipt_code,
    network: config.network,
    amountUsd: Number(updated?.amount_usd ?? row.amount_usd),
    payer: settled.payer ?? verified.payer ?? null,
  };
}

/** Atomically claim a settled payment so one payment funds exactly one analysis. */
export async function consumePayment(args: {
  userId: string;
  paymentId: string;
  product: ProductCode;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("payments")
    .update({ status: "consumed", consumed_at: new Date().toISOString() })
    .eq("id", args.paymentId)
    .eq("user_id", args.userId)
    .eq("product", args.product)
    .eq("status", "settled")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[payments] consume failed", error.message);
    return { ok: false, reason: "Could not confirm your payment." };
  }
  if (!data) {
    return {
      ok: false,
      reason: "Payment required: no settled payment is available for this analysis.",
    };
  }
  return { ok: true };
}
