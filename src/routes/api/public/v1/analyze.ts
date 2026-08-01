import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, json, preflight } from "@/lib/api.server";
import { createQuote, verifyAndSettle } from "@/lib/payments.server";
import { createAnalysis } from "@/lib/analysis-run.server";
import { X402_VERSION, type ProductCode } from "@/lib/x402";

const PRODUCTS: ProductCode[] = ["match_analysis", "premium_ats", "recruiter_bulk"];

export const Route = createFileRoute("/api/public/v1/analyze")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        const caller = await authenticateRequest(request);
        if (!caller) {
          return json({ error: "Unauthorized. Send Authorization: Bearer <access token>." }, 401);
        }

        let body: {
          resumeId?: string;
          jobDescriptionId?: string;
          product?: ProductCode;
          paymentId?: string;
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "Request body must be JSON." }, 400);
        }

        const product = body.product ?? "match_analysis";
        if (!PRODUCTS.includes(product)) return json({ error: "Unknown product." }, 400);
        if (!body.resumeId || !body.jobDescriptionId) {
          return json({ error: "resumeId and jobDescriptionId are required." }, 400);
        }

        const paymentHeader = request.headers.get("x-payment");

        // No payment attached: answer with a machine-readable x402 challenge.
        if (!paymentHeader && !body.paymentId) {
          try {
            const quote = await createQuote(caller.supabase, caller.userId, product);
            return json(
              {
                x402Version: X402_VERSION,
                error: "Payment required",
                accepts: quote.accepts,
                paymentId: quote.paymentId,
              },
              402,
            );
          } catch (error) {
            return json(
              { error: error instanceof Error ? error.message : "Payment setup failed." },
              503,
            );
          }
        }

        let paymentId = body.paymentId ?? "";
        let settlement: Awaited<ReturnType<typeof verifyAndSettle>> | null = null;

        if (paymentHeader) {
          if (!paymentId) return json({ error: "paymentId is required with X-PAYMENT." }, 400);
          try {
            settlement = await verifyAndSettle({
              userId: caller.userId,
              paymentId,
              paymentHeader,
            });
          } catch (error) {
            return json(
              { error: error instanceof Error ? error.message : "Payment failed." },
              402,
            );
          }
        }

        try {
          const result = await createAnalysis(caller.supabase, caller.userId, {
            resumeId: body.resumeId,
            jobDescriptionId: body.jobDescriptionId,
            product,
            paymentId,
          });
          return json(
            { id: result.id, overallScore: result.overallScore, report: result.report },
            200,
            settlement
              ? {
                  "x-payment-response": btoa(
                    JSON.stringify({
                      success: true,
                      transaction: settlement.txHash,
                      network: settlement.network,
                      receipt: settlement.receiptCode,
                    }),
                  ),
                }
              : {},
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Analysis failed.";
          const status = message.startsWith("Payment required") ? 402 : 500;
          return json({ error: message }, status);
        }
      },
    },
  },
});
