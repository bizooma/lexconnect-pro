
CREATE OR REPLACE FUNCTION public.has_white_label(_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.organization_id = _org
      AND s.plan = 'firm'::public.subscription_plan
      AND (
        s.status IN ('active','grandfathered')
        OR (s.status = 'trialing' AND (s.trial_end IS NULL OR s.trial_end > now()))
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_white_label(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "wcd_write" ON public.website_custom_domains;

CREATE POLICY "wcd_write"
  ON public.website_custom_domains FOR ALL TO authenticated
  USING (public.can_edit_website(organization_id, auth.uid()))
  WITH CHECK (
    public.can_edit_website(organization_id, auth.uid())
    AND public.org_can_write(organization_id)
    AND (mode <> 'portal' OR public.has_white_label(organization_id))
  );
