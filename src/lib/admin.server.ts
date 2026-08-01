/**
 * Server-only admin operations: platform metrics and role management.
 */
import type { AppSupabase } from "./db.server";
import { requireRole, writeAudit } from "./db.server";

export interface AdminOverview {
  users: number;
  analyses: number;
  completedAnalyses: number;
  failedAnalyses: number;
  revenueUsd: number;
  settledPayments: number;
  averageScore: number;
  recentPayments: {
    id: string;
    product: string;
    amount_usd: number;
    status: string;
    tx_hash: string | null;
    created_at: string;
  }[];
}

export async function getAdminOverview(
  supabase: AppSupabase,
  userId: string,
): Promise<AdminOverview> {
  await requireRole(supabase, userId, "admin");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [usersRes, analysesRes, paymentsRes] = await Promise.all([
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("analyses").select("status, overall_score"),
    supabaseAdmin
      .from("payments")
      .select("id, product, amount_usd, status, tx_hash, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const analyses = analysesRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const settled = payments.filter((p) => p.status === "settled" || p.status === "consumed");
  const scores = analyses
    .filter((a) => a.status === "completed")
    .map((a) => Number(a.overall_score ?? 0))
    .filter((n) => n > 0);

  return {
    users: usersRes.count ?? 0,
    analyses: analyses.length,
    completedAnalyses: analyses.filter((a) => a.status === "completed").length,
    failedAnalyses: analyses.filter((a) => a.status === "failed").length,
    revenueUsd: settled.reduce((sum, p) => sum + Number(p.amount_usd), 0),
    settledPayments: settled.length,
    averageScore: scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0,
    recentPayments: payments.slice(0, 20).map((p) => ({
      ...p,
      amount_usd: Number(p.amount_usd),
    })),
  };
}

export async function updatePricing(
  supabase: AppSupabase,
  userId: string,
  input: { product: "match_analysis" | "premium_ats" | "recruiter_bulk"; priceUsd: number; active: boolean },
) {
  await requireRole(supabase, userId, "admin");
  if (!(input.priceUsd >= 0 && input.priceUsd <= 100)) {
    throw new Error("Price must be between $0 and $100.");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("pricing")
    .update({ price_usd: input.priceUsd, active: input.active, updated_at: new Date().toISOString() })
    .eq("product", input.product);
  if (error) throw new Error("Could not update pricing.");
  await writeAudit({
    userId,
    action: "pricing.updated",
    entity: "pricing",
    entityId: input.product,
    metadata: { priceUsd: input.priceUsd, active: input.active },
  });
  return { ok: true as const };
}
