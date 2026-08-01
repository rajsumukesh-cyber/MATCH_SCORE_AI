import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  deleteResume,
  getResume,
  listResumes,
  saveResume,
} from "@/lib/library.server";

export const fetchResumes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listResumes(context.supabase));

export const fetchResume = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) => getResume(context.supabase, data.id));

export const upsertResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      title: string;
      rawText: string;
      filePath?: string | null;
      fileType?: string | null;
      fileSize?: number | null;
    }) => input,
  )
  .handler(async ({ context, data }) => saveResume(context.supabase, context.userId, data));

export const removeResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) =>
    deleteResume(context.supabase, context.userId, data.id),
  );
