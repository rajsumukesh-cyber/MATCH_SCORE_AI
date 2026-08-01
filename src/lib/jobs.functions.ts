import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { deleteJob, getJob, listJobs, saveJob } from "@/lib/library.server";

export const fetchJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listJobs(context.supabase));

export const fetchJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) => getJob(context.supabase, data.id));

export const upsertJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { id?: string; title?: string; content: string; company?: string | null }) => input,
  )
  .handler(async ({ context, data }) => saveJob(context.supabase, context.userId, data));

export const removeJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) => deleteJob(context.supabase, context.userId, data.id));
