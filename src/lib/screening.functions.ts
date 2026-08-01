import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createScreeningRun,
  deleteScreening,
  finalizeScreeningRun,
  getScreening,
  listScreenings,
  runScreening,
  screenCandidateInRun,
} from "@/lib/screening.server";

export const startScreening = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      jobDescriptionId: string;
      resumeIds: string[];
      cutoff: number;
      anonymize: boolean;
    }) => input,
  )
  .handler(async ({ context, data }) => runScreening(context.supabase, context.userId, data));

export const fetchScreenings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listScreenings(context.supabase));

export const fetchScreening = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) => getScreening(context.supabase, data.id));

export const removeScreening = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) => deleteScreening(context.supabase, data.id));

export const beginScreeningRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      jobDescriptionId: string;
      cutoff: number;
      anonymize: boolean;
      candidateCount: number;
    }) => input,
  )
  .handler(async ({ context, data }) =>
    createScreeningRun(context.supabase, context.userId, data),
  );

export const screenQueuedCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { screeningId: string; resumeId: string; index: number }) => input)
  .handler(async ({ context, data }) =>
    screenCandidateInRun(context.supabase, context.userId, data),
  );

export const completeScreeningRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { screeningId: string; failedCount: number; redactedFields: number }) => input,
  )
  .handler(async ({ context, data }) =>
    finalizeScreeningRun(context.supabase, context.userId, data),
  );
