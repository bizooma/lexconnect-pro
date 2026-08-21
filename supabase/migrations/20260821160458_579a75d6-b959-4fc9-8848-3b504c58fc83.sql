REVOKE ALL ON public.referral_panel FROM anon;
REVOKE ALL ON public.referral_intakes FROM anon;
REVOKE ALL ON public.referral_assignments FROM anon;
REVOKE ALL ON public.referral_matching_rules FROM anon;

GRANT SELECT, UPDATE, DELETE ON public.referral_panel TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.referral_intakes TO authenticated;
GRANT SELECT ON public.referral_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_matching_rules TO authenticated;

REVOKE EXECUTE ON FUNCTION public.apply_to_referral_panel(uuid,text[],text[],text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_my_panel_profile(uuid,text[],text[],text[],text,int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.run_intake_matching(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.assign_referral(uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.respond_to_referral_assignment(uuid,text,text) FROM anon;