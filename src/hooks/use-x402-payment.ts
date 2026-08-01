import { useState } from "react";
import { toast } from "sonner";
import { requestQuote, submitPayment, settleSandboxPayment } from "@/lib/payments.functions";
import { signPayment, WalletError } from "@/lib/wallet";
import type { ProductCode } from "@/lib/x402";


export type PayStage = "idle" | "quoting" | "signing" | "settling" | "done";

export interface PaidReceipt {
  paymentId: string;
  txHash: string | null;
  receiptCode: string;
  amountUsd: number;
  network: string;
}

/**
 * Runs the full x402 flow: request a quote (402 requirements), sign the
 * EIP-3009 authorization in the wallet, then verify + settle server-side.
 */
export function useX402Payment() {
  const [stage, setStage] = useState<PayStage>("idle");
  const [error, setError] = useState<string | null>(null);

  async function pay(product: ProductCode): Promise<PaidReceipt | null> {
    setError(null);
    try {
      setStage("quoting");
      const quote = await requestQuote({ data: { product } });

      if (quote.mode === "sandbox") {
        setStage("settling");
        const sandbox = await settleSandboxPayment({ data: { paymentId: quote.paymentId } });
        setStage("done");
        return {
          paymentId: sandbox.paymentId,
          txHash: sandbox.txHash,
          receiptCode: sandbox.receiptCode,
          amountUsd: sandbox.amountUsd,
          network: sandbox.network,
        };
      }

      const requirements = quote.accepts[0];
      if (!requirements) throw new Error("No payment method was offered.");

      setStage("signing");
      const { header } = await signPayment(requirements);

      setStage("settling");
      const result = await submitPayment({
        data: { paymentId: quote.paymentId, paymentHeader: header },
      });

      setStage("done");
      return {
        paymentId: result.paymentId,
        txHash: result.txHash,
        receiptCode: result.receiptCode,
        amountUsd: result.amountUsd,
        network: result.network,
      };

    } catch (err) {
      const message =
        err instanceof WalletError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Payment failed.";
      setError(message);
      toast.error(message);
      setStage("idle");
      return null;
    }
  }

  return { pay, stage, error, reset: () => setStage("idle") };
}

export const STAGE_COPY: Record<PayStage, string> = {
  idle: "Pay and analyze",
  quoting: "Requesting price…",
  signing: "Confirm in your wallet…",
  settling: "Settling on-chain…",
  done: "Paid",
};
