CREATE OR REPLACE FUNCTION public.page_in_org(_page_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.website_pages p
    WHERE p.id = _page_id AND p.organization_id = _org_id
  )
$$;

REVOKE ALL ON FUNCTION public.page_in_org(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.page_in_org(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Website editors can create page revisions" ON public.website_page_revisions;
CREATE POLICY "Website editors can create page revisions"
ON public.website_page_revisions FOR INSERT TO authenticated
WITH CHECK (
  public.can_edit_website(organization_id, auth.uid())
  AND public.page_in_org(page_id, organization_id)
);

ALTER TABLE public.website_pages
  ADD COLUMN IF NOT EXISTS show_in_nav boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nav_order integer NOT NULL DEFAULT 100;