/**
 * Module 1 — AI Explainable Recruiter (server only).
 *
 * Screens a batch of resumes against one job role with a cutoff percentage.
 * Candidates at or above the cutoff are shortlisted; the rest receive the
 * remaining topics they need to study, plus alternative roles the manager
 * should consider them for. All text is bias-redacted before it reaches the
 * model when anonymous mode is on.
 */
import { chatJson } from "./ai.server";
import { redactPii, scanJobBias, summarizeBias, type BiasFlag } from "./bias.server";
import type { AppSupabase } from "./db.server";
import { enforceRateLimit, writeAudit } from "./db.server";

export interface StudyTopic {
  topic: string;
  why_it_matters: string;
  what_to_learn: string;
  effort: string;
}

interface ScreeningVerdict {
  score: number;
  experience_score: number;
  topic_score: number;
  rationale: string;
  matched_skills: string[];
  missing_skills: string[];
  study_topics: StudyTopic[];
  alternative_roles: string[];
  evidence: string[];
}

const stringArray = { type: "array", items: { type: "string" } };

const VERDICT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    score: { type: "integer" },
    experience_score: { type: "integer" },
    topic_score: { type: "integer" },
    rationale: { type: "string" },
    matched_skills: stringArray,
    missing_skills: stringArray,
    study_topics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          why_it_matters: { type: "string" },
          what_to_learn: { type: "string" },
          effort: { type: "string" },
        },
        required: ["topic", "why_it_matters", "what_to_learn", "effort"],
      },
    },
    alternative_roles: stringArray,
    evidence: stringArray,
  },
  required: ["score", "rationale", "matched_skills", "missing_skills"],
};

const SYSTEM = `You are an explainable technical screening engine.

Hard rules:
- Score ONLY on demonstrated experience and mastery of the topics the role needs.
- The text is anonymised. Tokens like [CANDIDATE], [EMAIL], [AGE], [GENDER],
  [PERSONAL], [PHOTO] are redactions. Never guess who the person is, and never
  let identity, age, gender, nationality, marital status or location affect the score.
- score is 0-100 and must be justified by evidence quoted from the resume.
- matched_skills / missing_skills are normalised skill names from the job requirements.
- study_topics: the remaining topics this candidate must learn to clear the role,
  ordered by impact. 3-6 items. what_to_learn is concrete (concepts, not courses).
- alternative_roles: other roles this person is already strong enough for, based on
  the topics they DO know. Empty if none apply.
- Plain professional English. No markdown, no emojis.`;

function clampScore(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, v));
}

async function screenOne(args: {
  jobText: string;
  jobTitle: string;
  resumeText: string;
  cutoff: number;
}): Promise<ScreeningVerdict> {
  const raw = await chatJson<ScreeningVerdict>({
    system: SYSTEM,
    schemaName: "screening_verdict",
    schema: VERDICT_SCHEMA,
    maxTokens: 3500,
    user: `Screen this candidate for the role "${args.jobTitle}". The shortlist cutoff is ${args.cutoff}%.

=== ROLE REQUIREMENTS ===
${args.jobText.slice(0, 10000)}

=== ANONYMISED CANDIDATE PROFILE ===
${args.resumeText.slice(0, 18000)}`,
  });

  return {
    score: clampScore(raw.score),
    experience_score: clampScore(raw.experience_score ?? raw.score),
    topic_score: clampScore(raw.topic_score ?? raw.score),
    rationale: raw.rationale ?? "",
    matched_skills: raw.matched_skills ?? [],
    missing_skills: raw.missing_skills ?? [],
    study_topics: raw.study_topics ?? [],
    alternative_roles: raw.alternative_roles ?? [],
    evidence: raw.evidence ?? [],
  };
}

export interface RunScreeningInput {
  jobDescriptionId: string;
  resumeIds: string[];
  cutoff: number;
  anonymize: boolean;
}

export async function runScreening(
  supabase: AppSupabase,
  userId: string,
  input: RunScreeningInput,
) {
  await enforceRateLimit(userId, "screening.completed", 5);

  const cutoff = Math.min(100, Math.max(0, Math.round(input.cutoff)));
  const resumeIds = input.resumeIds.slice(0, 20);
  if (resumeIds.length === 0) throw new Error("Select at least one resume to screen.");

  const [{ data: job }, { data: resumes }] = await Promise.all([
    supabase
      .from("job_descriptions")
      .select("id, title, content, company")
      .eq("id", input.jobDescriptionId)
      .maybeSingle(),
    supabase.from("resumes").select("id, title, raw_text, candidate_name").in("id", resumeIds),
  ]);

  if (!job) throw new Error("Job role not found.");
  if (!resumes || resumes.length === 0) throw new Error("No matching resumes were found.");

  const jobFlags = scanJobBias(job.content);

  const { data: screening, error: createError } = await supabase
    .from("screenings")
    .insert({
      user_id: userId,
      job_description_id: job.id,
      title: job.title,
      cutoff,
      anonymize: input.anonymize,
      status: "processing",
      candidate_count: resumes.length,
    })
    .select("id")
    .single();

  if (createError || !screening) throw new Error("Could not start the screening run.");

  try {
    const results = await Promise.all(
      resumes.map(async (resume, index) => {
        const redaction = input.anonymize
          ? redactPii(resume.raw_text, resume.candidate_name)
          : { text: resume.raw_text, flags: [] as BiasFlag[], redactedCount: 0 };

        const verdict = await screenOne({
          jobText: job.content,
          jobTitle: job.title,
          resumeText: redaction.text,
          cutoff,
        });

        const label = input.anonymize
          ? `Candidate ${String.fromCharCode(65 + (index % 26))}${index >= 26 ? index : ""}`
          : (resume.candidate_name ?? resume.title);

        return { resume, verdict, redaction, label };
      }),
    );

    const rows = results.map(({ resume, verdict, redaction, label }) => ({
      screening_id: screening.id,
      user_id: userId,
      resume_id: resume.id,
      candidate_label: label,
      score: verdict.score,
      selected: verdict.score >= cutoff,
      matched_skills: verdict.matched_skills,
      missing_skills: verdict.missing_skills,
      study_topics: (verdict.score >= cutoff ? [] : verdict.study_topics) as never,
      rationale: verdict.rationale,
      alternative_roles: verdict.score >= cutoff ? [] : verdict.alternative_roles,
      bias_flags: redaction.flags as never,
    }));

    const { error: insertError } = await supabase.from("screening_candidates").insert(rows);
    if (insertError) throw new Error("The screening finished but the results could not be saved.");

    const summary = summarizeBias({
      anonymized: input.anonymize,
      redactedFields: results.reduce((sum, r) => sum + r.redaction.redactedCount, 0),
      jobFlags,
      candidateFlagCount: results.reduce((sum, r) => sum + r.redaction.flags.length, 0),
      scores: rows.map((r) => r.score),
    });

    await supabase
      .from("screenings")
      .update({
        status: "completed",
        selected_count: rows.filter((r) => r.selected).length,
        bias_summary: summary as never,
        completed_at: new Date().toISOString(),
      })
      .eq("id", screening.id);

    await writeAudit({
      userId,
      action: "screening.completed",
      entity: "screening",
      entityId: screening.id,
      metadata: { candidates: rows.length, cutoff },
    });

    return { id: screening.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Screening failed.";
    await supabase
      .from("screenings")
      .update({ status: "failed", error_message: message.slice(0, 400) })
      .eq("id", screening.id);
    throw error;
  }
}

export async function listScreenings(supabase: AppSupabase, limit = 50) {
  const { data, error } = await supabase
    .from("screenings")
    .select(
      "id, created_at, title, cutoff, anonymize, status, candidate_count, selected_count, error_message",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Could not load your screening runs.");
  return data ?? [];
}

export async function getScreening(supabase: AppSupabase, id: string) {
  const [{ data: screening }, { data: candidates }] = await Promise.all([
    supabase.from("screenings").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("screening_candidates")
      .select("*")
      .eq("screening_id", id)
      .order("score", { ascending: false }),
  ]);
  if (!screening) throw new Error("Screening run not found.");
  return { screening, candidates: candidates ?? [] };
}

export async function deleteScreening(supabase: AppSupabase, id: string) {
  const { error } = await supabase.from("screenings").delete().eq("id", id);
  if (error) throw new Error("Could not delete this screening run.");
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Queued batch screening: one candidate per call so the browser can
 * show live progress and retry individual failures.
 * ------------------------------------------------------------------ */

export async function createScreeningRun(
  supabase: AppSupabase,
  userId: string,
  input: { jobDescriptionId: string; cutoff: number; anonymize: boolean; candidateCount: number },
) {
  await enforceRateLimit(userId, "screening.started", 10);

  const cutoff = Math.min(100, Math.max(0, Math.round(input.cutoff)));
  const { data: job } = await supabase
    .from("job_descriptions")
    .select("id, title")
    .eq("id", input.jobDescriptionId)
    .maybeSingle();
  if (!job) throw new Error("Job role not found.");

  const { data: screening, error } = await supabase
    .from("screenings")
    .insert({
      user_id: userId,
      job_description_id: job.id,
      title: job.title,
      cutoff,
      anonymize: input.anonymize,
      status: "processing",
      candidate_count: Math.max(0, Math.round(input.candidateCount)),
    })
    .select("id")
    .single();

  if (error || !screening) throw new Error("Could not start the screening run.");

  await writeAudit({
    userId,
    action: "screening.started",
    entity: "screening",
    entityId: screening.id,
    metadata: { candidates: input.candidateCount, cutoff },
  });

  return { screeningId: screening.id, title: job.title, cutoff };
}

export async function screenCandidateInRun(
  supabase: AppSupabase,
  userId: string,
  input: { screeningId: string; resumeId: string; index: number },
) {
  const [{ data: screening }, { data: resume }] = await Promise.all([
    supabase
      .from("screenings")
      .select("id, cutoff, anonymize, job_description_id")
      .eq("id", input.screeningId)
      .maybeSingle(),
    supabase
      .from("resumes")
      .select("id, title, raw_text, candidate_name")
      .eq("id", input.resumeId)
      .maybeSingle(),
  ]);

  if (!screening) throw new Error("Screening run not found.");
  if (!resume) throw new Error("Resume not found.");

  const { data: job } = await supabase
    .from("job_descriptions")
    .select("title, content")
    .eq("id", screening.job_description_id ?? "")
    .maybeSingle();
  if (!job) throw new Error("Job role not found.");

  const redaction = screening.anonymize
    ? redactPii(resume.raw_text, resume.candidate_name)
    : { text: resume.raw_text, flags: [] as BiasFlag[], redactedCount: 0 };

  const verdict = await screenOne({
    jobText: job.content,
    jobTitle: job.title,
    resumeText: redaction.text,
    cutoff: screening.cutoff,
  });

  const label = screening.anonymize
    ? `Candidate ${String.fromCharCode(65 + (input.index % 26))}${input.index >= 26 ? input.index : ""}`
    : (resume.candidate_name ?? resume.title);

  const selected = verdict.score >= screening.cutoff;

  const { error } = await supabase.from("screening_candidates").insert({
    screening_id: screening.id,
    user_id: userId,
    resume_id: resume.id,
    candidate_label: label,
    score: verdict.score,
    selected,
    matched_skills: verdict.matched_skills,
    missing_skills: verdict.missing_skills,
    study_topics: (selected ? [] : verdict.study_topics) as never,
    rationale: verdict.rationale,
    alternative_roles: selected ? [] : verdict.alternative_roles,
    bias_flags: redaction.flags as never,
  });
  if (error) throw new Error("The candidate was scored but the result could not be saved.");

  return { label, score: verdict.score, selected, redactedCount: redaction.redactedCount };
}

export async function finalizeScreeningRun(
  supabase: AppSupabase,
  userId: string,
  input: { screeningId: string; failedCount: number; redactedFields: number },
) {
  const [{ data: screening }, { data: candidates }] = await Promise.all([
    supabase
      .from("screenings")
      .select("id, anonymize, job_description_id")
      .eq("id", input.screeningId)
      .maybeSingle(),
    supabase
      .from("screening_candidates")
      .select("score, selected, bias_flags")
      .eq("screening_id", input.screeningId),
  ]);
  if (!screening) throw new Error("Screening run not found.");

  const { data: job } = await supabase
    .from("job_descriptions")
    .select("content")
    .eq("id", screening.job_description_id ?? "")
    .maybeSingle();

  const rows = candidates ?? [];
  const summary = summarizeBias({
    anonymized: screening.anonymize,
    redactedFields: input.redactedFields,
    jobFlags: job ? scanJobBias(job.content) : [],
    candidateFlagCount: rows.reduce(
      (sum, r) => sum + (Array.isArray(r.bias_flags) ? r.bias_flags.length : 0),
      0,
    ),
    scores: rows.map((r) => r.score),
  });

  await supabase
    .from("screenings")
    .update({
      status: rows.length === 0 ? "failed" : "completed",
      candidate_count: rows.length,
      selected_count: rows.filter((r) => r.selected).length,
      bias_summary: summary as never,
      error_message:
        input.failedCount > 0 ? `${input.failedCount} candidate(s) could not be scored.` : null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", input.screeningId);

  await writeAudit({
    userId,
    action: "screening.completed",
    entity: "screening",
    entityId: input.screeningId,
    metadata: { candidates: rows.length, failed: input.failedCount },
  });

  return { id: input.screeningId, scored: rows.length };
}
