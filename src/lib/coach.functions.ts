import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildCoachPlan,
  deleteCoachPlan,
  getCoachPlan,
  listCoachPlans,
} from "@/lib/coach.server";

export const createCoachPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { resumeId: string; jobDescriptionId?: string | null; targetRole?: string | null }) =>
      input,
  )
  .handler(async ({ context, data }) => buildCoachPlan(context.supabase, context.userId, data));

export const fetchCoachPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listCoachPlans(context.supabase));

export const fetchCoachPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) => getCoachPlan(context.supabase, data.id));

export const removeCoachPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) => deleteCoachPlan(context.supabase, data.id));
