REVOKE EXECUTE ON FUNCTION public.get_org_directory(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.send_member_referral(uuid, uuid, text, text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.respond_to_member_referral(uuid, text, text) FROM anon;