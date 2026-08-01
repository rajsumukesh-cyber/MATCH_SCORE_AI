/**
 * Server-only AI matching engine: builds the prompt, enforces the report
 * schema, and blends the LLM judgement with embedding-based semantic
 * similarity for an explainable final score.
 */
import { ANALYSIS_MODEL, chatJson, cosineSimilarity, embed } from "./ai.server";
import type { ProductCode } from "./x402";

export interface MatchReport {
  summary: string;
  score_explanation: string;
  overall_score: number;
  ats_score: number;
  category_scores: {
    skills: number;
    experience: number;
    education: number;
    certifications: number;
    keywords: number;
  };
  skills_match_percent: number;
  experience_match_percent: number;
  education_match: string;
  matching_qualifications: string[];
  missing_technical_skills: string[];
  missing_soft_skills: string[];
  missing_technologies: string[];
  keyword_gaps: string[];
  suggested_keywords: string[];
  strengths: string[];
  weaknesses: string[];
  improvement_recommendations: string[];
  better_bullet_points: { original: string; improved: string }[];
  recommended_certifications: string[];
  suggested_projects: string[];
  suggested_achievements: string[];
  summary_rewrite: string;
  ats_optimization_tips: string[];
  optimization_checklist: { item: string; done: boolean }[];
  hiring_likelihood: "Low" | "Moderate" | "Strong" | "Very strong";
  confidence: number;
}

const stringArray = { type: "array", items: { type: "string" } };

const REPORT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    summary: { type: "string" },
    score_explanation: { type: "string" },
    overall_score: { type: "integer" },
    ats_score: { type: "integer" },
    category_scores: {
      type: "object",
      properties: {
        skills: { type: "integer" },
        experience: { type: "integer" },
        education: { type: "integer" },
        certifications: { type: "integer" },
        keywords: { type: "integer" },
      },
      required: ["skills", "experience", "education", "certifications", "keywords"],
    },
    skills_match_percent: { type: "integer" },
    experience_match_percent: { type: "integer" },
    education_match: { type: "string" },
    matching_qualifications: stringArray,
    missing_technical_skills: stringArray,
    missing_soft_skills: stringArray,
    missing_technologies: stringArray,
    keyword_gaps: stringArray,
    suggested_keywords: stringArray,
    strengths: stringArray,
    weaknesses: stringArray,
    improvement_recommendations: stringArray,
    better_bullet_points: {
      type: "array",
      items: {
        type: "object",
        properties: { original: { type: "string" }, improved: { type: "string" } },
        required: ["original", "improved"],
      },
    },
    recommended_certifications: stringArray,
    suggested_projects: stringArray,
    suggested_achievements: stringArray,
    summary_rewrite: { type: "string" },
    ats_optimization_tips: stringArray,
    optimization_checklist: {
      type: "array",
      items: {
        type: "object",
        properties: { item: { type: "string" }, done: { type: "boolean" } },
        required: ["item", "done"],
      },
    },
    hiring_likelihood: { type: "string", enum: ["Low", "Moderate", "Strong", "Very strong"] },
    confidence: { type: "number" },
  },
  required: [
    "summary",
    "score_explanation",
    "overall_score",
    "ats_score",
    "category_scores",
    "hiring_likelihood",
    "confidence",
  ],
};

const SYSTEM_PROMPT = `You are a senior technical recruiter and certified ATS consultant.
You compare a candidate resume against a job description and produce a rigorous,
explainable evaluation.

Rules:
- Be strict and evidence-based. Never invent experience the resume does not show.
- Scores are integers 0-100. A perfect 100 requires every hard requirement met.
- Normalize skill names (e.g. "ReactJS" = "React", "postgres" = "PostgreSQL").
- keyword_gaps must contain literal terms from the job description absent from the resume.
- better_bullet_points must quote real resume lines in "original" and rewrite them
  with action verb + scope + quantified outcome.
- score_explanation must justify the overall score in 3-5 sentences referencing
  concrete matches and gaps.
- Write in plain professional English. No markdown, no emojis.`;

const PRODUCT_DIRECTIVE: Record<ProductCode, string> = {
  match_analysis:
    "Deliver a complete match analysis with actionable recommendations. Aim for 5-8 items in each list.",
  premium_ats:
    "This is a PREMIUM ATS audit. Be exhaustive: 8-14 items per list, at least 6 rewritten bullet points, a 10-item optimization checklist, and a full summary rewrite tailored to the role.",
  recruiter_bulk:
    "This evaluation is part of a recruiter ranking run. Prioritize precise scoring and concise evidence; 3-5 items per list is enough.",
};

function clamp(n: unknown, fallback = 0): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return fallback;
  return Math.min(100, Math.max(0, v));
}

export interface AnalysisResult {
  report: MatchReport;
  semanticSimilarity: number;
  model: string;
}

export async function runAnalysis(args: {
  resumeText: string;
  jobText: string;
  product: ProductCode;
  roleTitle?: string | null;
}): Promise<AnalysisResult> {
  const resumeText = args.resumeText.slice(0, 24000);
  const jobText = args.jobText.slice(0, 12000);

  // Semantic similarity runs in parallel with the LLM judgement.
  const similarityPromise = embed([resumeText, jobText])
    .then(([a, b]) => (a && b ? cosineSimilarity(a, b) : 0))
    .catch((error) => {
      console.error("[analysis] embedding failed, continuing without it", error);
      return 0;
    });

  const raw = await chatJson<MatchReport>({
    system: SYSTEM_PROMPT,
    schemaName: "resume_match_report",
    schema: REPORT_SCHEMA,
    maxTokens: args.product === "premium_ats" ? 9000 : 6000,
    user: `${PRODUCT_DIRECTIVE[args.product]}

=== JOB DESCRIPTION${args.roleTitle ? ` (${args.roleTitle})` : ""} ===
${jobText}

=== CANDIDATE RESUME ===
${resumeText}`,
  });

  const semanticSimilarity = await similarityPromise;

  const categories = raw.category_scores ?? {
    skills: 0,
    experience: 0,
    education: 0,
    certifications: 0,
    keywords: 0,
  };

  const report: MatchReport = {
    ...raw,
    overall_score: clamp(raw.overall_score),
    ats_score: clamp(raw.ats_score),
    skills_match_percent: clamp(raw.skills_match_percent, clamp(categories.skills)),
    experience_match_percent: clamp(raw.experience_match_percent, clamp(categories.experience)),
    category_scores: {
      skills: clamp(categories.skills),
      experience: clamp(categories.experience),
      education: clamp(categories.education),
      certifications: clamp(categories.certifications),
      keywords: clamp(categories.keywords),
    },
    matching_qualifications: raw.matching_qualifications ?? [],
    missing_technical_skills: raw.missing_technical_skills ?? [],
    missing_soft_skills: raw.missing_soft_skills ?? [],
    missing_technologies: raw.missing_technologies ?? [],
    keyword_gaps: raw.keyword_gaps ?? [],
    suggested_keywords: raw.suggested_keywords ?? [],
    strengths: raw.strengths ?? [],
    weaknesses: raw.weaknesses ?? [],
    improvement_recommendations: raw.improvement_recommendations ?? [],
    better_bullet_points: raw.better_bullet_points ?? [],
    recommended_certifications: raw.recommended_certifications ?? [],
    suggested_projects: raw.suggested_projects ?? [],
    suggested_achievements: raw.suggested_achievements ?? [],
    ats_optimization_tips: raw.ats_optimization_tips ?? [],
    optimization_checklist: raw.optimization_checklist ?? [],
    confidence: Math.min(1, Math.max(0, Number(raw.confidence) || 0.75)),
  };

  return { report, semanticSimilarity, model: ANALYSIS_MODEL };
}

const RESUME_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    name: { type: "string" },
    email: { type: "string" },
    phone: { type: "string" },
    location: { type: "string" },
    links: stringArray,
    headline: { type: "string" },
    summary: { type: "string" },
    skills: stringArray,
    languages: stringArray,
    certifications: stringArray,
    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          institution: { type: "string" },
          degree: { type: "string" },
          field: { type: "string" },
          year: { type: "string" },
        },
        required: ["institution"],
      },
    },
    experience: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: { type: "string" },
          role: { type: "string" },
          start: { type: "string" },
          end: { type: "string" },
          highlights: stringArray,
        },
        required: ["company", "role"],
      },
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          tech: stringArray,
        },
        required: ["name"],
      },
    },
    total_years_experience: { type: "number" },
  },
  required: ["skills"],
};

export interface ParsedResume {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  links?: string[];
  headline?: string;
  summary?: string;
  skills: string[];
  languages?: string[];
  certifications?: string[];
  education?: { institution: string; degree?: string; field?: string; year?: string }[];
  experience?: {
    company: string;
    role: string;
    start?: string;
    end?: string;
    highlights?: string[];
  }[];
  projects?: { name: string; description?: string; tech?: string[] }[];
  total_years_experience?: number;
}

export async function parseResumeText(text: string): Promise<ParsedResume> {
  return chatJson<ParsedResume>({
    system:
      "You extract structured data from resumes. Return only what is present in the text; omit fields you cannot find. Normalize skill names to their canonical form.",
    user: `Extract the structured profile from this resume:\n\n${text.slice(0, 24000)}`,
    schema: RESUME_SCHEMA,
    schemaName: "parsed_resume",
    maxTokens: 4000,
  });
}

const JOB_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    title: { type: "string" },
    company: { type: "string" },
    location: { type: "string" },
    seniority: { type: "string" },
    employment_type: { type: "string" },
    required_skills: stringArray,
    preferred_skills: stringArray,
    responsibilities: stringArray,
    required_certifications: stringArray,
    education_requirement: { type: "string" },
    min_years_experience: { type: "number" },
    ats_keywords: stringArray,
  },
  required: ["title", "required_skills"],
};

export interface ParsedJob {
  title: string;
  company?: string;
  location?: string;
  seniority?: string;
  employment_type?: string;
  required_skills: string[];
  preferred_skills?: string[];
  responsibilities?: string[];
  required_certifications?: string[];
  education_requirement?: string;
  min_years_experience?: number;
  ats_keywords?: string[];
}

export async function parseJobText(text: string): Promise<ParsedJob> {
  return chatJson<ParsedJob>({
    system:
      "You extract structured hiring requirements from job descriptions. ats_keywords are the literal terms an ATS would screen on.",
    user: `Extract the structured requirements from this job description:\n\n${text.slice(0, 12000)}`,
    schema: JOB_SCHEMA,
    schemaName: "parsed_job",
    maxTokens: 3000,
  });
}
