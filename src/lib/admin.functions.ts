import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminOverview, updatePricing } from "@/lib/admin.server";
import type { ProductCode } from "@/lib/x402";

export const checkAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { hasRole } = await import("@/lib/db.server");
    return { isAdmin: await hasRole(context.supabase, context.userId, "admin") };
  });

export const fetchAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { hasRole } = await import("@/lib/db.server");
    const isAdmin = await hasRole(context.supabase, context.userId, "admin");
    if (!isAdmin) return { forbidden: true as const };
    const overview = await getAdminOverview(context.supabase, context.userId);
    return { forbidden: false as const, overview };
  });

export const setPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { product: ProductCode; priceUsd: number; active: boolean }) => input)
  .handler(async ({ context, data }) => updatePricing(context.supabase, context.userId, data));
