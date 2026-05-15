
CREATE TABLE public.website_custom_domains (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  domain text NOT NULL UNIQUE,
  verification_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  verified_at timestamptz,
  is_primary boolean NOT NULL DEFAULT false,
  default_page_slug text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT website_custom_domains_domain_format
    CHECK (domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$')
);

CREATE INDEX idx_wcd_org ON public.website_custom_domains (organization_id);

ALTER TABLE public.website_custom_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wcd_select"
  ON public.website_custom_domains FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "wcd_write"
  ON public.website_custom_domains FOR ALL TO authenticated
  USING (public.can_edit_website(organization_id, auth.uid()))
  WITH CHECK (public.can_edit_website(organization_id, auth.uid()) AND public.org_can_write(organization_id));

CREATE TRIGGER wcd_updated_at BEFORE UPDATE ON public.website_custom_domains
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
