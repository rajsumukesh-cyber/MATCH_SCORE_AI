-- Bootstrap the first admin: earliest profile, only when no admin exists yet.
DO $$
DECLARE first_user uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    SELECT id INTO first_user FROM public.profiles ORDER BY created_at ASC LIMIT 1;
    IF first_user IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (first_user, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;
END $$;

-- Admin-only helper to promote another account later (callable by existing admins).
CREATE OR REPLACE FUNCTION public.grant_admin_role(_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE target uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can grant admin access';
  END IF;
  SELECT id INTO target FROM public.profiles WHERE lower(email) = lower(_email) LIMIT 1;
  IF target IS NULL THEN
    RETURN false;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (target, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.grant_admin_role(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_admin_role(text) TO authenticated;