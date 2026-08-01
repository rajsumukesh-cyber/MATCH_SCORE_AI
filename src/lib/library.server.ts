/**
 * Server-only CRUD for resumes and job descriptions.
 */
import type { Json } from "@/integrations/supabase/types";
import type { AppSupabase } from "./db.server";
import { sanitizeText, writeAudit } from "./db.server";
import { parseJobText, parseResumeText } from "./analysis.server";

export const MAX_RESUME_CHARS = 60000;
export const MAX_JOB_CHARS = 30000;

export interface ResumeSummary {
  id: string;
  title: string;
  candidate_name: string | null;
  file_type: string | null;
  file_size: number | null;
  version: number;
  created_at: string;
  updated_at: string;
  parsed: Json;
}

export async function listResumes(supabase: AppSupabase): Promise<ResumeSummary[]> {
  const { data, error } = await supabase
    .from("resumes")
    .select(
      "id, title, candidate_name, file_type, file_size, version, created_at, updated_at, parsed",
    )
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Could not load your resumes.");
  return (data ?? []) as ResumeSummary[];
}

export async function getResume(supabase: AppSupabase, id: string) {
  const { data, error } = await supabase.from("resumes").select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("Resume not found.");
  return data;
}

export async function saveResume(
  supabase: AppSupabase,
  userId: string,
  input: {
    id?: string;
    title: string;
    rawText: string;
    filePath?: string | null;
    fileType?: string | null;
    fileSize?: number | null;
  },
) {
  const rawText = sanitizeText(input.rawText, MAX_RESUME_CHARS);
  if (rawText.length < 120) {
    throw new Error("That resume has too little readable text. Try a different file.");
  }

  let parsed: Record<string, unknown> = {};
  let candidateName: string | null = null;
  try {
    const result = await parseResumeText(rawText);
    parsed = result as unknown as Record<string, unknown>;
    candidateName = result.name ?? null;
  } catch (error) {
    console.error("[resumes] structured parse failed", error);
  }

  const payload = {
    user_id: userId,
    title: sanitizeText(input.title, 160) || "Untitled resume",
    raw_text: rawText,
    parsed: parsed as never,
    candidate_name: candidateName,
    file_path: input.filePath ?? null,
    file_type: input.fileType ?? null,
    file_size: input.fileSize ?? null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data: existing } = await supabase
      .from("resumes")
      .select("version")
      .eq("id", input.id)
      .maybeSingle();
    const { data, error } = await supabase
      .from("resumes")
      .update({ ...payload, version: (existing?.version ?? 1) + 1 })
      .eq("id", input.id)
      .select("id")
      .single();
    if (error) throw new Error("Could not update that resume.");
    await writeAudit({ userId, action: "resume.updated", entity: "resume", entityId: data.id });
    return { id: data.id };
  }

  const { data, error } = await supabase.from("resumes").insert(payload).select("id").single();
  if (error) {
    console.error("[resumes] insert failed", error.message);
    throw new Error("Could not save that resume.");
  }
  await writeAudit({ userId, action: "resume.created", entity: "resume", entityId: data.id });
  return { id: data.id };
}

export async function deleteResume(supabase: AppSupabase, userId: string, id: string) {
  const { data } = await supabase.from("resumes").select("file_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("resumes").delete().eq("id", id);
  if (error) throw new Error("Could not delete that resume.");
  if (data?.file_path) {
    await supabase.storage.from("resumes").remove([data.file_path]);
  }
  await writeAudit({ userId, action: "resume.deleted", entity: "resume", entityId: id });
  return { ok: true as const };
}

export interface JobSummary {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  seniority: string | null;
  created_at: string;
  updated_at: string;
  parsed: Json;
}

export async function listJobs(supabase: AppSupabase): Promise<JobSummary[]> {
  const { data, error } = await supabase
    .from("job_descriptions")
    .select("id, title, company, location, seniority, created_at, updated_at, parsed")
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Could not load your job descriptions.");
  return (data ?? []) as JobSummary[];
}

export async function getJob(supabase: AppSupabase, id: string) {
  const { data, error } = await supabase
    .from("job_descriptions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new Error("Job description not found.");
  return data;
}

export async function saveJob(
  supabase: AppSupabase,
  userId: string,
  input: { id?: string; title?: string; content: string; company?: string | null },
) {
  const content = sanitizeText(input.content, MAX_JOB_CHARS);
  if (content.length < 80) throw new Error("That job description is too short to analyze.");

  let parsed: Record<string, unknown> = {};
  let derived: {
    title?: string;
    company?: string;
    location?: string;
    seniority?: string;
  } = {};
  try {
    const result = await parseJobText(content);
    parsed = result as unknown as Record<string, unknown>;
    derived = result;
  } catch (error) {
    console.error("[jobs] structured parse failed", error);
  }

  const payload = {
    user_id: userId,
    title: sanitizeText(input.title || derived.title || "Untitled role", 160),
    company: input.company ?? derived.company ?? null,
    location: derived.location ?? null,
    seniority: derived.seniority ?? null,
    content,
    parsed: parsed as never,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("job_descriptions")
      .update(payload)
      .eq("id", input.id)
      .select("id")
      .single();
    if (error) throw new Error("Could not update that job description.");
    await writeAudit({ userId, action: "job.updated", entity: "job", entityId: data.id });
    return { id: data.id };
  }

  const { data, error } = await supabase
    .from("job_descriptions")
    .insert(payload)
    .select("id")
    .single();
  if (error) {
    console.error("[jobs] insert failed", error.message);
    throw new Error("Could not save that job description.");
  }
  await writeAudit({ userId, action: "job.created", entity: "job", entityId: data.id });
  return { id: data.id };
}

export async function deleteJob(supabase: AppSupabase, userId: string, id: string) {
  const { error } = await supabase.from("job_descriptions").delete().eq("id", id);
  if (error) throw new Error("Could not delete that job description.");
  await writeAudit({ userId, action: "job.deleted", entity: "job", entityId: id });
  return { ok: true as const };
}
