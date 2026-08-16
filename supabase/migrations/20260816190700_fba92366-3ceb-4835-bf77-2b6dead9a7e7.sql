CREATE TABLE public.platform_admin_audit_log (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id           uuid,
  actor_email             text,
  action                  text NOT NULL,
  target_user_id          uuid,
  target_organization_id  uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  details                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  result                  text NOT NULL CHECK (result IN ('success','error','denied')),
  error_message           text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_paal_org     ON public.platform_admin_audit_log (target_organization_id, created_at DESC);
CREATE INDEX idx_paal_actor   ON public.platform_admin_audit_log (actor_user_id, created_at DESC);
CREATE INDEX idx_paal_created ON public.platform_admin_audit_log (created_at DESC);

GRANT SELECT ON public.platform_admin_audit_log TO authenticated;
GRANT ALL ON public.platform_admin_audit_log TO service_role;

ALTER TABLE public.platform_admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins view audit entries for their org"
  ON public.platform_admin_audit_log
  FOR SELECT TO authenticated
  USING (target_organization_id IS NOT NULL
         AND is_org_admin(target_organization_id, auth.uid()));

CREATE POLICY "Platform admins view all audit entries"
  ON public.platform_admin_audit_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

REVOKE INSERT, UPDATE, DELETE ON public.platform_admin_audit_log FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.platform_admin_audit_log_is_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'platform_admin_audit_log is append-only (attempted %)', TG_OP;
END;
$$;

CREATE TRIGGER platform_admin_audit_log_no_mutate
  BEFORE UPDATE OR DELETE ON public.platform_admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.platform_admin_audit_log_is_append_only();