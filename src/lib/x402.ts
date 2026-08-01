/**
 * Shared x402 micropayment types and constants.
 * Client-safe: no secrets, no server-only imports.
 *
 * x402 is an open HTTP-native payment protocol. A protected resource answers
 * `402 Payment Required` with machine-readable payment requirements; the client
 * signs an EIP-3009 `transferWithAuthorization` and retries with an
 * `X-PAYMENT` header. The server verifies and settles through a facilitator.
 */

export const X402_VERSION = 1;

export type ProductCode = "match_analysis" | "premium_ats" | "recruiter_bulk";

export type X402Network = "base-sepolia" | "base";

export interface X402PaymentRequirements {
  scheme: "exact";
  network: X402Network;
  /** Atomic units of the asset (USDC has 6 decimals). */
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra: { name: string; version: string };
}

export interface X402Quote {
  x402Version: number;
  accepts: X402PaymentRequirements[];
  product: ProductCode;
  priceUsd: number;
  paymentId: string;
  /** "sandbox" means no on-chain wallet signature is required. */
  mode: "onchain" | "sandbox";
  error?: string;
}

export interface X402Authorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
}

export interface X402PaymentPayload {
  x402Version: number;
  scheme: "exact";
  network: X402Network;
  payload: { signature: string; authorization: X402Authorization };
}

/** USDC contract per supported network. */
export const USDC_ADDRESS: Record<X402Network, string> = {
  "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

export const CHAIN_ID: Record<X402Network, number> = {
  "base-sepolia": 84532,
  base: 8453,
};

export const USDC_DECIMALS = 6;

export function usdToAtomic(usd: number): string {
  return BigInt(Math.round(usd * 10 ** USDC_DECIMALS)).toString();
}

export function atomicToUsd(atomic: string): number {
  return Number(atomic) / 10 ** USDC_DECIMALS;
}

export function encodePaymentHeader(payload: X402PaymentPayload): string {
  const json = JSON.stringify(payload);
  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(json)));
  }
  return Buffer.from(json, "utf8").toString("base64");
}

export function decodePaymentHeader(header: string): X402PaymentPayload {
  const json =
    typeof atob === "function"
      ? decodeURIComponent(escape(atob(header)))
      : Buffer.from(header, "base64").toString("utf8");
  return JSON.parse(json) as X402PaymentPayload;
}

export const PRODUCT_LABELS: Record<ProductCode, string> = {
  match_analysis: "Resume Match Analysis",
  premium_ats: "Premium ATS Report",
  recruiter_bulk: "Recruiter Bulk Analysis",
};
