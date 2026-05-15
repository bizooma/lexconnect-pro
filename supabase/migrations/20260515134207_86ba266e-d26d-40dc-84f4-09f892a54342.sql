-- 1) Form submissions table
CREATE TABLE IF NOT EXISTS public.website_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  page_id UUID REFERENCES public.website_pages(id) ON DELETE SET NULL,
  section_id UUID REFERENCES public.website_sections(id) ON DELETE SET NULL,
  form_kind TEXT NOT NULL CHECK (form_kind IN ('newsletter','contact')),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wfs_org_created ON public.website_form_submissions (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wfs_page ON public.website_form_submissions (page_id);

ALTER TABLE public.website_form_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit website forms" ON public.website_form_submissions;
CREATE POLICY "Anyone can submit website forms"
  ON public.website_form_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Editors can read org submissions" ON public.website_form_submissions;
CREATE POLICY "Editors can read org submissions"
  ON public.website_form_submissions
  FOR SELECT
  TO authenticated
  USING (public.can_edit_website(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Editors can delete org submissions" ON public.website_form_submissions;
CREATE POLICY "Editors can delete org submissions"
  ON public.website_form_submissions
  FOR DELETE
  TO authenticated
  USING (public.can_edit_website(organization_id, auth.uid()));

-- 2) Snapshot trigger: include sections in the saved snapshot
CREATE OR REPLACE FUNCTION public.website_pages_publish_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  act public.website_publish_action;
  sections_snapshot jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'published' THEN act := 'publish';
    ELSIF NEW.status = 'scheduled' THEN act := 'schedule';
    ELSIF NEW.status = 'archived' THEN act := 'archive';
    ELSIF OLD.status = 'published' AND NEW.status <> 'published' THEN act := 'unpublish';
    ELSE RETURN NEW;
    END IF;

    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'section_type', s.section_type,
          'display_order', s.display_order,
          'settings_json', s.settings_json,
          'content_json', s.content_json,
          'visible', s.visible,
          'responsive_json', s.responsive_json
        )
        ORDER BY s.display_order
      ),
      '[]'::jsonb
    )
    INTO sections_snapshot
    FROM public.website_sections s
    WHERE s.page_id = NEW.id;

    INSERT INTO public.website_publish_history
      (page_id, organization_id, published_by, action, version_snapshot_json)
    VALUES (
      NEW.id, NEW.organization_id, NEW.updated_by, act,
      jsonb_build_object(
        'title', NEW.title,
        'slug', NEW.slug,
        'page_type', NEW.page_type,
        'status', NEW.status,
        'meta_title', NEW.meta_title,
        'meta_description', NEW.meta_description,
        'content_json', NEW.content_json,
        'sections', sections_snapshot
      )
    );
  END IF;
  RETURN NEW;
END
$function$;

-- 3) Ensure scheduling extensions are available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;