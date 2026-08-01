ALTER TABLE public.screening_candidates
  ADD COLUMN alternative_roles TEXT[] NOT NULL DEFAULT '{}';