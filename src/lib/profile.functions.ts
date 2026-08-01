import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAccount, saveAccount } from "@/lib/profile.server";

export const fetchAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getAccount(context.supabase, context.userId));

export const updateAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { full_name?: string; headline?: string; company?: string }) => input)
  .handler(async ({ context, data }) => saveAccount(context.supabase, context.userId, data));
