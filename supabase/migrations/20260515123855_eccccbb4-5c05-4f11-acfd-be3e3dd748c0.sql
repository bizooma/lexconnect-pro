-- 1. Extend org_role enum
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'content_editor';

-- 2. Helper: can_edit_website
CREATE OR REPLACE FUNCTION public.can_edit_website(_org uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.organization_members
      WHERE organization_id = _org
        AND user_id = _user
        AND status = 'active'
        AND org_role::text IN ('owner','admin','content_editor')
    );
$$;

-- 3. Swap RLS predicates on website_* write policies

-- website_pages
DROP POLICY IF EXISTS website_pages_insert ON public.website_pages;
DROP POLICY IF EXISTS website_pages_update ON public.website_pages;
DROP POLICY IF EXISTS website_pages_delete ON public.website_pages;
CREATE POLICY website_pages_insert ON public.website_pages
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_website(organization_id, auth.uid()) AND public.org_can_write(organization_id));
CREATE POLICY website_pages_update ON public.website_pages
  FOR UPDATE TO authenticated
  USING (public.can_edit_website(organization_id, auth.uid()));
CREATE POLICY website_pages_delete ON public.website_pages
  FOR DELETE TO authenticated
  USING (public.can_edit_website(organization_id, auth.uid()));

-- website_sections
DROP POLICY IF EXISTS website_sections_write ON public.website_sections;
CREATE POLICY website_sections_write ON public.website_sections
  FOR ALL TO authenticated
  USING (public.can_edit_website(organization_id, auth.uid()))
  WITH CHECK (public.can_edit_website(organization_id, auth.uid()) AND public.org_can_write(organization_id));

-- website_brand_settings
DROP POLICY IF EXISTS website_brand_write ON public.website_brand_settings;
CREATE POLICY website_brand_write ON public.website_brand_settings
  FOR ALL TO authenticated
  USING (public.can_edit_website(organization_id, auth.uid()))
  WITH CHECK (public.can_edit_website(organization_id, auth.uid()) AND public.org_can_write(organization_id));

-- website_saved_sections
DROP POLICY IF EXISTS website_saved_write ON public.website_saved_sections;
CREATE POLICY website_saved_write ON public.website_saved_sections
  FOR ALL TO authenticated
  USING (public.can_edit_website(organization_id, auth.uid()))
  WITH CHECK (public.can_edit_website(organization_id, auth.uid()) AND public.org_can_write(organization_id));

-- website_ai_generations (insert)
DROP POLICY IF EXISTS website_ai_insert ON public.website_ai_generations;
CREATE POLICY website_ai_insert ON public.website_ai_generations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_edit_website(organization_id, auth.uid()));

-- website_templates (org-scoped writes)
DROP POLICY IF EXISTS website_templates_write ON public.website_templates;
CREATE POLICY website_templates_write ON public.website_templates
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (is_global = false AND organization_id IS NOT NULL
        AND public.can_edit_website(organization_id, auth.uid()))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (is_global = false AND organization_id IS NOT NULL
        AND public.can_edit_website(organization_id, auth.uid())
        AND public.org_can_write(organization_id))
  );