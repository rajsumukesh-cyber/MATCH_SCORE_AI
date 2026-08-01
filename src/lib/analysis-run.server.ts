/**
 * Server-only analysis orchestration: payment gate -> AI run -> persisted report.
 */
import type { AppSupabase } from "./db.server";
import { enforceRateLimit, writeAudit } from "./db.server";
import { runAnalysis } from "./analysis.server";
import { consumePayment } from "./payments.server";
import type { ProductCode } from "./x402";

export interface CreateAnalysisInput {
  resumeId: string;
  jobDescriptionId: string;
  product: ProductCode;
  paymentId: string;
}

export async function createAnalysis(
  supabase: AppSupabase,
  userId: string,
  input: CreateAnalysisInput,
) {
  await enforceRateLimit(userId, "analysis.completed", 10);

  const [{ data: resume }, { data: job }] = await Promise.all([
    supabase
      .from("resumes")
      .select("id, raw_text, title")
      .eq("id", input.resumeId)
      .maybeSingle(),
    supabase
      .from("job_descriptions")
      .select("id, content, title")
      .eq("id", input.jobDescriptionId)
      .maybeSingle(),
  ]);

  if (!resume) throw new Error("Resume not found.");
  if (!job) throw new Error("Job description not found.");

  const claim = await consumePayment({
    userId,
    paymentId: input.paymentId,
    product: input.product,
  });
  if (!claim.ok) throw new Error(claim.reason);

  const { data: created, error: createError } = await supabase
    .from("analyses")
    .insert({
      user_id: userId,
      resume_id: resume.id,
      job_description_id: job.id,
      payment_id: input.paymentId,
      product: input.product,
      role_title: job.title,
      status: "processing",
    })
    .select("id")
    .single();

  if (createError || !created) {
    console.error("[analysis] could not create row", createError?.message);
    throw new Error("Could not start the analysis.");
  }

  try {
    const { report, semanticSimilarity, model } = await runAnalysis({
      resumeText: resume.raw_text,
      jobText: job.content,
      product: input.product,
      roleTitle: job.title,
    });

    const { error: updateError } = await supabase
      .from("analyses")
      .update({
        status: "completed",
        report: report as never,
        model,
        semantic_similarity: semanticSimilarity,
        overall_score: report.overall_score,
        ats_score: report.ats_score,
        skills_score: report.category_scores.skills,
        experience_score: report.category_scores.experience,
        education_score: report.category_scores.education,
        certifications_score: report.category_scores.certifications,
        keywords_score: report.category_scores.keywords,
        hiring_likelihood: report.hiring_likelihood,
        confidence: report.confidence,
        completed_at: new Date().toISOString(),
      })
      .eq("id", created.id);

    if (updateError) {
      console.error("[analysis] could not persist report", updateError.message);
      throw new Error("The analysis finished but could not be saved.");
    }

    await writeAudit({
      userId,
      action: "analysis.completed",
      entity: "analysis",
      entityId: created.id,
      metadata: { product: input.product, score: report.overall_score },
    });

    return { id: created.id, report, overallScore: report.overall_score };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed.";
    await supabase
      .from("analyses")
      .update({ status: "failed", error_message: message.slice(0, 400) })
      .eq("id", created.id);
    await writeAudit({
      userId,
      action: "analysis.failed",
      entity: "analysis",
      entityId: created.id,
      metadata: { message },
    });
    throw error;
  }
}

export async function listAnalyses(supabase: AppSupabase, limit = 50) {
  const { data, error } = await supabase
    .from("analyses")
    .select(
      "id, created_at, completed_at, status, product, role_title, overall_score, ats_score, hiring_likelihood, resume_id, job_description_id",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Could not load your analyses.");
  return data ?? [];
}

export async function getAnalysis(supabase: AppSupabase, id: string) {
  const { data, error } = await supabase
    .from("analyses")
    .select("*, resumes(title, candidate_name), job_descriptions(title, company)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new Error("Analysis not found.");
  return data;
}

export interface DashboardStats {
  totalAnalyses: number;
  averageScore: number;
  bestScore: number;
  totalSpentUsd: number;
  resumeCount: number;
  jobCount: number;
  trend: { date: string; score: number }[];
  categoryAverages: {
    skills: number;
    experience: number;
    education: number;
    certifications: number;
    keywords: number;
  };
}

export async function getDashboardStats(supabase: AppSupabase): Promise<DashboardStats> {
  const [analysesRes, paymentsRes, resumesRes, jobsRes] = await Promise.all([
    supabase
      .from("analyses")
      .select(
        "created_at, overall_score, skills_score, experience_score, education_score, certifications_score, keywords_score, status",
      )
      .eq("status", "completed")
      .order("created_at", { ascending: true }),
    supabase.from("payments").select("amount_usd, status"),
    supabase.from("resumes").select("id", { count: "exact", head: true }),
    supabase.from("job_descriptions").select("id", { count: "exact", head: true }),
  ]);

  const rows = analysesRes.data ?? [];
  const scores = rows.map((r) => Number(r.overall_score ?? 0)).filter((n) => n > 0);
  const avg = (list: number[]) =>
    list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : 0;

  const settled = (paymentsRes.data ?? []).filter(
    (p) => p.status === "settled" || p.status === "consumed",
  );

  return {
    totalAnalyses: rows.length,
    averageScore: avg(scores),
    bestScore: scores.length ? Math.max(...scores) : 0,
    totalSpentUsd: settled.reduce((sum, p) => sum + Number(p.amount_usd), 0),
    resumeCount: resumesRes.count ?? 0,
    jobCount: jobsRes.count ?? 0,
    trend: rows.slice(-12).map((r) => ({
      date: r.created_at,
      score: Number(r.overall_score ?? 0),
    })),
    categoryAverages: {
      skills: avg(rows.map((r) => Number(r.skills_score ?? 0))),
      experience: avg(rows.map((r) => Number(r.experience_score ?? 0))),
      education: avg(rows.map((r) => Number(r.education_score ?? 0))),
      certifications: avg(rows.map((r) => Number(r.certifications_score ?? 0))),
      keywords: avg(rows.map((r) => Number(r.keywords_score ?? 0))),
    },
  };
}
