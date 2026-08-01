/**
 * Server-only profile + role reads.
 */
import type { AppSupabase } from "./db.server";
import { sanitizeText } from "./db.server";

export interface AccountProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  headline: string | null;
  company: string | null;
  avatar_url: string | null;
  roles: ("user" | "recruiter" | "admin")[];
}

export async function getAccount(supabase: AppSupabase, userId: string): Promise<AccountProfile> {
  const [profileRes, rolesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, headline, company, avatar_url")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);

  const roles = (rolesRes.data ?? []).map((r) => r.role);
  const profile = profileRes.data;

  return {
    id: userId,
    email: profile?.email ?? null,
    full_name: profile?.full_name ?? null,
    headline: profile?.headline ?? null,
    company: profile?.company ?? null,
    avatar_url: profile?.avatar_url ?? null,
    roles: roles.length ? roles : ["user"],
  };
}

export async function saveAccount(
  supabase: AppSupabase,
  userId: string,
  input: { full_name?: string; headline?: string; company?: string },
) {
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: input.full_name ? sanitizeText(input.full_name, 120) : null,
      headline: input.headline ? sanitizeText(input.headline, 160) : null,
      company: input.company ? sanitizeText(input.company, 120) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw new Error("Could not save your profile.");
  return { ok: true as const };
}
