REVOKE ALL ON FUNCTION public.sponsor_in_org(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_sponsor_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sponsor_in_org(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_sponsor_stats(uuid) TO authenticated, service_role;