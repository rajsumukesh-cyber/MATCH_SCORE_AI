NexVersa — AI Resume-to-Role Match Scorer
Overview
NexVersa is a production-ready AI SaaS platform that replaces hiring guesswork with explainable, evidence-backed resume-to-role matching. It parses unstructured resumes and job descriptions, scores candidates against real role requirements, and returns transparent reports that both recruiters and job seekers can act on.

Instead of an opaque ATS "pass/fail", every score is traceable: matched skills, missing keywords, experience gaps, education alignment, and concrete rewrite suggestions.

Problem
Job seekers get rejected with no explanation and no path to improve.
Recruiters manually skim hundreds of resumes per role.
Traditional ATS keyword filters are opaque and drop qualified candidates.
Hidden bias (names, age, gender, nationality) leaks into screening decisions.
Solution
One explainable scoring engine with four modules on top of it:

Match Scorer — resume vs. job description scoring with category breakdowns, strengths, weaknesses, missing skills, rewritten bullet points, and an ATS-readiness checklist.
Recruiter Batch Screening — queued, parallel screening of many candidates with live progress, automatic retries, and a ranked shortlist against a configurable cutoff.
Bias Detection — PII redaction (name, contact, DOB, age, gender, nationality) before AI scoring, plus biased-wording scanning of job descriptions.
AI Skill Gap Coach — prioritized skill gaps, free course recommendations, practice projects, a weekly plan, and a projected score improvement.
Key Features
Explainable, category-level match scoring blending LLM judgment with embedding similarity
Resume ingestion from PDF, DOCX, and TXT (parsed in-browser, never as server binaries)
Reusable libraries of saved resumes and job descriptions with AI structured parsing
Anonymous (bias-safe) screening mode
Role-based access: user, recruiter, admin — with a dedicated Access Denied experience
Admin dashboard: users, analyses, revenue, and average match score
x402 micropayments in USDC on Base (EIP-3009 authorizations), with prices shown in ₹ INR
Sandbox payment mode for testing without a wallet
Public REST API that issues HTTP 402 payment challenges for external agents
Architecture
Layer	Technology
Frontend	TanStack Start, React 19, TypeScript, Tailwind CSS v4, Framer Motion
Backend & Auth	Lovable Cloud (Supabase) with Row Level Security
AI	Lovable AI Gateway — chat completions with JSON schema enforcement + embeddings
Payments	x402 protocol, EIP-3009 USDC authorizations via Viem
Storage	Private bucket for resumes with owner-only access policies
Server logic runs as typed TanStack createServerFn RPCs; external/webhook traffic uses public API routes. All tables enforce RLS, roles live in a separate user_roles table checked through a security-definer function, and sensitive actions are written to an audit log.

Data Model (core tables)
profiles, user_roles, resumes, job_descriptions, analyses, pricing, payments, audit_logs, screenings, screening_candidates, coach_plans.

Payment Flow (x402)
Client requests an analysis and receives a priced quote.
Server responds with an HTTP 402 challenge (amount, asset, receiver, network).
Wallet signs an EIP-3009 USDC transfer authorization.
Signed X-PAYMENT header is verified and settled server-side.
The payment is atomically consumed by exactly one analysis, and a receipt is recorded.
If no receiving wallet is configured, the platform falls back to a clearly labelled sandbox mode.

Roadmap
Bulk recruiter ranking and role-level leaderboards
Live FX rates instead of a fixed USD→INR conversion
AI-generated interview question sets per candidate
Employer-side analytics on funnel quality and bias trends
Team NexVersa — fair, explainable, evidence-based hiring.
