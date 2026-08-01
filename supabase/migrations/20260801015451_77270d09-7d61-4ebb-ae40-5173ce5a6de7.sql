CREATE TABLE public.screenings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  job_description_id UUID REFERENCES public.job_descriptions ON DELETE SET NULL,
  title TEXT NOT NULL,
  cutoff INTEGER NOT NULL DEFAULT 70,
  anonymize BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'completed',
  candidate_count INTEGER NOT NULL DEFAULT 0,
  selected_count INTEGER NOT NULL DEFAULT 0,
  bias_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE public.screening_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  screening_id UUID NOT NULL REFERENCES public.screenings ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  resume_id UUID REFERENCES public.resumes ON DELETE SET NULL,
  candidate_label TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  selected BOOLEAN NOT NULL DEFAULT false,
  matched_skills TEXT[] NOT NULL DEFAULT '{}',
  missing_skills TEXT[] NOT NULL DEFAULT '{}',
  study_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  rationale TEXT,
  bias_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.coach_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  resume_id UUID REFERENCES public.resumes ON DELETE SET NULL,
  job_description_id UUID REFERENCES public.job_descriptions ON DELETE SET NULL,
  target_role TEXT NOT NULL,
  current_score INTEGER NOT NULL DEFAULT 0,
  projected_score INTEGER NOT NULL DEFAULT 0,
  plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_screenings_user ON public.screenings (user_id, created_at DESC);
CREATE INDEX idx_screening_candidates_screening ON public.screening_candidates (screening_id);
CREATE INDEX idx_coach_plans_user ON public.coach_plans (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.screenings TO authenticated;
GRANT ALL ON public.screenings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.screening_candidates TO authenticated;
GRANT ALL ON public.screening_candidates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_plans TO authenticated;
GRANT ALL ON public.coach_plans TO service_role;

ALTER TABLE public.screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screening_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own screenings" ON public.screenings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage their own screening candidates" ON public.screening_candidates
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage their own coach plans" ON public.coach_plans
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);