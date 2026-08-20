REVOKE ALL ON FUNCTION public.ai_monthly_limit(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_monthly_limit(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.ai_monthly_limit(uuid) FROM authenticated;