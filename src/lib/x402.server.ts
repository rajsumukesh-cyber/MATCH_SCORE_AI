/**
 * Server-only x402 facilitator client + pricing helpers.
 * Never import this from client-reachable module scope.
 */
import {
  CHAIN_ID,
  USDC_ADDRESS,
  X402_VERSION,
  usdToAtomic,
  type ProductCode,
  type X402Network,
  type X402PaymentPayload,
  type X402PaymentRequirements,
} from "./x402";

export interface X402Config {
  network: X402Network;
  facilitatorUrl: string;
  payTo: string;
}

export function getX402Config(): X402Config {
  const network = (process.env.X402_NETWORK ?? "base-sepolia") as X402Network;
  const facilitatorUrl = (
    process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator"
  ).replace(/\/$/, "");
  const payTo = process.env.X402_PAY_TO_ADDRESS ?? "";

  if (!payTo) {
    throw new Error(
      "x402 is not configured: missing receiving wallet address (X402_PAY_TO_ADDRESS).",
    );
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(payTo)) {
    throw new Error("x402 receiving wallet address is malformed.");
  }
  if (!(network in CHAIN_ID)) {
    throw new Error(`Unsupported x402 network: ${network}`);
  }
  return { network, facilitatorUrl, payTo };
}

export function buildRequirements(args: {
  config: X402Config;
  priceUsd: number;
  product: ProductCode;
  resource: string;
  description: string;
}): X402PaymentRequirements {
  const { config, priceUsd, resource, description } = args;
  return {
    scheme: "exact",
    network: config.network,
    maxAmountRequired: usdToAtomic(priceUsd),
    resource,
    description,
    mimeType: "application/json",
    payTo: config.payTo,
    maxTimeoutSeconds: 300,
    asset: USDC_ADDRESS[config.network],
    extra: { name: "USDC", version: "2" },
  };
}

interface FacilitatorVerifyResponse {
  isValid?: boolean;
  invalidReason?: string;
  payer?: string;
}

interface FacilitatorSettleResponse {
  success?: boolean;
  errorReason?: string;
  transaction?: string;
  network?: string;
  payer?: string;
}

async function facilitatorPost<T>(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: T | null; raw: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.X402_FACILITATOR_API_KEY) {
    headers.Authorization = `Bearer ${process.env.X402_FACILITATOR_API_KEY}`;
  }
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const raw = await res.text();
  let data: T | null = null;
  try {
    data = JSON.parse(raw) as T;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data, raw };
}

/** Ask the facilitator whether a signed payment payload is valid and funded. */
export async function verifyPayment(
  config: X402Config,
  paymentPayload: X402PaymentPayload,
  paymentRequirements: X402PaymentRequirements,
): Promise<{ valid: boolean; reason?: string; payer?: string }> {
  const { data, raw, ok } = await facilitatorPost<FacilitatorVerifyResponse>(
    `${config.facilitatorUrl}/verify`,
    { x402Version: X402_VERSION, paymentPayload, paymentRequirements },
  );
  if (!ok || !data) {
    console.error("[x402] verify transport failure", raw.slice(0, 400));
    return { valid: false, reason: "Payment verification service is unavailable." };
  }
  if (!data.isValid) {
    return { valid: false, reason: data.invalidReason ?? "Payment was rejected." };
  }
  return { valid: true, payer: data.payer ?? paymentPayload.payload.authorization.from };
}

/** Broadcast the authorized transfer on-chain through the facilitator. */
export async function settlePayment(
  config: X402Config,
  paymentPayload: X402PaymentPayload,
  paymentRequirements: X402PaymentRequirements,
): Promise<{ settled: boolean; txHash?: string; reason?: string; payer?: string }> {
  const { data, raw, ok } = await facilitatorPost<FacilitatorSettleResponse>(
    `${config.facilitatorUrl}/settle`,
    { x402Version: X402_VERSION, paymentPayload, paymentRequirements },
  );
  if (!ok || !data) {
    console.error("[x402] settle transport failure", raw.slice(0, 400));
    return { settled: false, reason: "Payment settlement service is unavailable." };
  }
  if (!data.success) {
    return { settled: false, reason: data.errorReason ?? "Settlement failed." };
  }
  return {
    settled: true,
    txHash: data.transaction,
    payer: data.payer ?? paymentPayload.payload.authorization.from,
  };
}

/** Basic structural validation before touching the facilitator. */
export function validatePayloadShape(
  payload: X402PaymentPayload,
  requirements: X402PaymentRequirements,
): string | null {
  if (payload.x402Version !== X402_VERSION) return "Unsupported x402 version.";
  if (payload.scheme !== "exact") return "Unsupported payment scheme.";
  if (payload.network !== requirements.network) return "Payment is on the wrong network.";
  const auth = payload.payload?.authorization;
  if (!auth) return "Payment authorization is missing.";
  if (auth.to.toLowerCase() !== requirements.payTo.toLowerCase())
    return "Payment recipient does not match.";
  if (BigInt(auth.value) < BigInt(requirements.maxAmountRequired))
    return "Payment amount is too low.";
  if (Number(auth.validBefore) * 1000 < Date.now()) return "Payment authorization has expired.";
  return null;
}
