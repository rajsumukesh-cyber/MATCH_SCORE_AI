REVOKE EXECUTE ON FUNCTION public.grant_admin_role(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.grant_admin_role(text) TO service_role;