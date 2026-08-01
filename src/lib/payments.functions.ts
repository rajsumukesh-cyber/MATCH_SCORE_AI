import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createQuote, getPaymentMode, settleSandbox, verifyAndSettle } from "@/lib/payments.server";
import { listPricing, listPayments } from "@/lib/pricing.server";
import type { ProductCode } from "@/lib/x402";

export const fetchPricing = createServerFn({ method: "GET" }).handler(async () => listPricing());

export const fetchPaymentMode = createServerFn({ method: "GET" }).handler(async () =>
  getPaymentMode(),
);

export const requestQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { product: ProductCode }) => input)
  .handler(async ({ context, data }) =>
    createQuote(context.supabase, context.userId, data.product),
  );

export const submitPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paymentId: string; paymentHeader: string }) => input)
  .handler(async ({ context, data }) =>
    verifyAndSettle({
      userId: context.userId,
      paymentId: data.paymentId,
      paymentHeader: data.paymentHeader,
    }),
  );

export const settleSandboxPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paymentId: string }) => input)
  .handler(async ({ context, data }) =>
    settleSandbox({ userId: context.userId, paymentId: data.paymentId }),
  );

export const fetchPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listPayments(context.supabase));
