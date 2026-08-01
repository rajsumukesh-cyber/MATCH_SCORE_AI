import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createAnalysis,
  getAnalysis,
  getDashboardStats,
  listAnalyses,
} from "@/lib/analysis-run.server";
import type { ProductCode } from "@/lib/x402";

export const runMatchAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      resumeId: string;
      jobDescriptionId: string;
      product: ProductCode;
      paymentId: string;
    }) => input,
  )
  .handler(async ({ context, data }) => createAnalysis(context.supabase, context.userId, data));

export const fetchAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listAnalyses(context.supabase));

export const fetchAnalysis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) => getAnalysis(context.supabase, data.id));

export const fetchDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getDashboardStats(context.supabase));
