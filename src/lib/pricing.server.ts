/**
 * Server-only pricing catalog + payment history reads.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AppSupabase } from "./db.server";
import type { ProductCode } from "./x402";

export interface PricingRow {
  product: ProductCode;
  label: string;
  description: string | null;
  price_usd: number;
  active: boolean;
}

/** Public catalog read: uses the publishable key so it works pre-auth and during SSR. */
export async function listPricing(): Promise<PricingRow[]> {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const client = createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });

  const { data, error } = await client
    .from("pricing")
    .select("product, label, description, price_usd, active")
    .eq("active", true)
    .order("price_usd", { ascending: true });

  if (error) {
    console.error("[pricing] read failed", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({ ...row, price_usd: Number(row.price_usd) }));
}

export interface PaymentRow {
  id: string;
  product: ProductCode;
  amount_usd: number;
  status: Database["public"]["Enums"]["payment_status"];
  tx_hash: string | null;
  network: string | null;
  receipt_code: string;
  created_at: string;
}

export async function listPayments(supabase: AppSupabase): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("id, product, amount_usd, status, tx_hash, network, receipt_code, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Could not load your payment history.");
  return (data ?? []).map((row) => ({ ...row, amount_usd: Number(row.amount_usd) }));
}
