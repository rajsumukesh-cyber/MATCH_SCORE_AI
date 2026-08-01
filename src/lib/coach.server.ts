/**
 * Module 3 — AI Skill Gap Coach (server only).
 *
 * Identifies the skills a candidate is missing for a target role, recommends
 * free courses and practice projects, and projects how much the match score
 * would rise once each gap is closed.
 */
import { chatJson } from "./ai.server";
import { redactPii } from "./bias.server";
import type { AppSupabase } from "./db.server";
import { enforceRateLimit, writeAudit } from "./db.server";

export interface SkillGap {
  skill: string;
  priority: "critical" | "high" | "medium" | "low";
  current_level: string;
  target_level: string;
  score_gain: number;
  learn_in: string;
}

export interface FreeCourse {
  title: string;
  provider: string;
  url: string;
  hours: number;
  covers: string[];
  cost: string;
}

export interface PracticeProject {
  title: string;
  description: string;
  skills: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  weeks: number;
  resume_bullet: string;
}

export interface CoachPlan {
  target_role: string;
  current_score: number;
  projected_score: number;
  readiness_summary: string;
  strengths: string[];
  skill_gaps: SkillGap[];
  free_courses: FreeCourse[];
  practice_projects: PracticeProject[];
  weekly_plan: { week: number; focus: string; outcome: string }[];
  quick_wins: string[];
  certifications: string[];
}

const stringArray = { type: "array", items: { type: "string" } };

const PLAN_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    current_score: { type: "integer" },
    projected_score: { type: "integer" },
    readiness_summary: { type: "string" },
    strengths: stringArray,
    skill_gaps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          skill: { type: "string" },
          priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
          current_level: { type: "string" },
          target_level: { type: "string" },
          score_gain: { type: "integer" },
          learn_in: { type: "string" },
        },
        required: ["skill", "priority", "score_gain", "learn_in"],
      },
    },
    free_courses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          provider: { type: "string" },
          url: { type: "string" },
          hours: { type: "number" },
          covers: stringArray,
          cost: { type: "string" },
        },
        required: ["title", "provider", "url", "hours", "cost"],
      },
    },
    practice_projects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          skills: stringArray,
          difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
          weeks: { type: "number" },
          resume_bullet: { type: "string" },
        },
        required: ["title", "description", "difficulty", "weeks"],
      },
    },
    weekly_plan: {
      type: "array",
      items: {
        type: "object",
        properties: {
          week: { type: "integer" },
          focus: { type: "string" },
          outcome: { type: "string" },
        },
        required: ["week", "focus", "outcome"],
      },
    },
    quick_wins: stringArray,
    certifications: stringArray,
  },
  required: ["current_score", "projected_score", "readiness_summary", "skill_gaps"],
};

const SYSTEM = `You are an AI skill-gap coach for job seekers.

Rules:
- Judge only on demonstrated experience and topics. Redaction tokens such as
  [CANDIDATE], [EMAIL], [AGE], [GENDER] must never influence your assessment.
- current_score is today's honest match against the target role (0-100).
- projected_score is the realistic score after every listed gap is closed. It must
  be greater than current_score and the individual score_gain values should roughly
  add up to the difference.
- free_courses must be genuinely free to audit and must be real, well-known
  resources (freeCodeCamp, CS50 / edX audit, MIT OpenCourseWare, Khan Academy,
  Google/Microsoft/AWS free learning paths, official documentation, YouTube course
  channels). Use the real landing-page URL. Never invent a course or a URL.
- practice_projects must be buildable solo and each ends with a resume_bullet
  written as action verb + scope + measurable outcome.
- weekly_plan covers 4-8 weeks, one entry per week.
- Plain professional English. No markdown, no emojis.`;

function clamp(n: unknown, fallback = 0): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return fallback;
  return Math.min(100, Math.max(0, v));
}

export interface BuildCoachPlanInput {
  resumeId: string;
  jobDescriptionId?: string | null;
  targetRole?: string | null;
}

export async function buildCoachPlan(
  supabase: AppSupabase,
  userId: string,
  input: BuildCoachPlanInput,
) {
  await enforceRateLimit(userId, "coach.completed", 6);

  const { data: resume } = await supabase
    .from("resumes")
    .select("id, title, raw_text, candidate_name")
    .eq("id", input.resumeId)
    .maybeSingle();
  if (!resume) throw new Error("Resume not found.");

  let jobText = "";
  let targetRole = (input.targetRole ?? "").trim();

  if (input.jobDescriptionId) {
    const { data: job } = await supabase
      .from("job_descriptions")
      .select("id, title, content")
      .eq("id", input.jobDescriptionId)
      .maybeSingle();
    if (job) {
      jobText = job.content;
      if (!targetRole) targetRole = job.title;
    }
  }

  if (!targetRole) throw new Error("Choose a target role or a saved job description.");

  const redacted = redactPii(resume.raw_text, resume.candidate_name);

  const raw = await chatJson<CoachPlan>({
    system: SYSTEM,
    schemaName: "skill_gap_plan",
    schema: PLAN_SCHEMA,
    maxTokens: 7000,
    user: `Build a skill-gap coaching plan for the target role "${targetRole}".
${jobText ? `\n=== TARGET ROLE REQUIREMENTS ===\n${jobText.slice(0, 10000)}\n` : ""}
=== ANONYMISED CANDIDATE PROFILE ===
${redacted.text.slice(0, 18000)}`,
  });

  const currentScore = clamp(raw.current_score);
  const plan: CoachPlan = {
    target_role: targetRole,
    current_score: currentScore,
    projected_score: Math.max(currentScore, clamp(raw.projected_score, currentScore)),
    readiness_summary: raw.readiness_summary ?? "",
    strengths: raw.strengths ?? [],
    skill_gaps: raw.skill_gaps ?? [],
    free_courses: raw.free_courses ?? [],
    practice_projects: raw.practice_projects ?? [],
    weekly_plan: raw.weekly_plan ?? [],
    quick_wins: raw.quick_wins ?? [],
    certifications: raw.certifications ?? [],
  };

  const { data: created, error } = await supabase
    .from("coach_plans")
    .insert({
      user_id: userId,
      resume_id: resume.id,
      job_description_id: input.jobDescriptionId ?? null,
      target_role: targetRole,
      current_score: plan.current_score,
      projected_score: plan.projected_score,
      plan: plan as never,
    })
    .select("id")
    .single();

  if (error || !created) throw new Error("The plan was built but could not be saved.");

  await writeAudit({
    userId,
    action: "coach.completed",
    entity: "coach_plan",
    entityId: created.id,
    metadata: { targetRole, current: plan.current_score, projected: plan.projected_score },
  });

  return { id: created.id, plan };
}

export async function listCoachPlans(supabase: AppSupabase, limit = 30) {
  const { data, error } = await supabase
    .from("coach_plans")
    .select("id, created_at, target_role, current_score, projected_score, resume_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Could not load your coaching plans.");
  return data ?? [];
}

export async function getCoachPlan(supabase: AppSupabase, id: string) {
  const { data, error } = await supabase
    .from("coach_plans")
    .select("*, resumes(title)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new Error("Coaching plan not found.");
  return data;
}

export async function deleteCoachPlan(supabase: AppSupabase, id: string) {
  const { error } = await supabase.from("coach_plans").delete().eq("id", id);
  if (error) throw new Error("Could not delete this plan.");
  return { ok: true };
}
