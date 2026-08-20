CREATE TABLE public.website_page_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.website_pages(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sections_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX website_page_revisions_page_idx ON public.website_page_revisions (page_id, created_at DESC);

GRANT SELECT, INSERT ON public.website_page_revisions TO authenticated;
GRANT ALL ON public.website_page_revisions TO service_role;

ALTER TABLE public.website_page_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Website editors can view page revisions"
ON public.website_page_revisions FOR SELECT TO authenticated
USING (public.can_edit_website(organization_id, auth.uid()));

CREATE POLICY "Website editors can create page revisions"
ON public.website_page_revisions FOR INSERT TO authenticated
WITH CHECK (public.can_edit_website(organization_id, auth.uid()));