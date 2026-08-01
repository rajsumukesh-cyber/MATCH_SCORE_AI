/**
 * Server-only shared helpers: audit logging, role checks, rate limiting.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AppSupabase = SupabaseClient<Database>;

export async function writeAudit(args: {
  userId: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      user_id: args.userId,
      action: args.action,
      entity: args.entity ?? null,
      entity_id: args.entityId ?? null,
      metadata: (args.metadata ?? {}) as never,
    });
  } catch (error) {
    console.error("[audit] failed to record", args.action, error);
  }
}

export async function hasRole(
  supabase: AppSupabase,
  userId: string,
  role: "user" | "recruiter" | "admin",
): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: role });
  if (error) {
    console.error("[roles] lookup failed", error.message);
    return false;
  }
  return Boolean(data);
}

export async function requireRole(
  supabase: AppSupabase,
  userId: string,
  role: "recruiter" | "admin",
) {
  const allowed = await hasRole(supabase, userId, role);
  if (!allowed) throw new Error("Forbidden: this action requires elevated access.");
}

/** Coarse per-user rate limit backed by the audit trail. */
export async function enforceRateLimit(userId: string, action: string, perMinute: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await supabaseAdmin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", action)
    .gte("created_at", since);
  if (error) return;
  if ((count ?? 0) >= perMinute) {
    throw new Error("You are going too fast. Please wait a moment and try again.");
  }
}

export function sanitizeText(input: string, max: number): string {
  return input.replace(/\u0000/g, "").trim().slice(0, max);
}
