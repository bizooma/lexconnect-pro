
CREATE TABLE public.website_page_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  page_id uuid NOT NULL,
  referrer text,
  user_agent text,
  visitor_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wpv_org_created ON public.website_page_views (organization_id, created_at DESC);
CREATE INDEX idx_wpv_page_created ON public.website_page_views (page_id, created_at DESC);

ALTER TABLE public.website_page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view analytics"
  ON public.website_page_views FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
