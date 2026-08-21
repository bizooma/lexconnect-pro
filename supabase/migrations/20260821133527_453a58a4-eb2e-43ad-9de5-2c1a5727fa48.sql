REVOKE ALL ON public.member_directory_prefs FROM anon;
REVOKE ALL ON public.member_referrals FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_directory_prefs TO authenticated;
GRANT SELECT ON public.member_referrals TO authenticated;