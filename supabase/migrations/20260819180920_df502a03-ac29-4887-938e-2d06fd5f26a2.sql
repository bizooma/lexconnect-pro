CREATE TABLE public.org_sponsor_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) <= 40),
  rank integer NOT NULL DEFAULT 100,
  annual_price_cents integer CHECK (annual_price_cents IS NULL OR annual_price_cents >= 0),
  benefits text[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_sponsor_tiers TO authenticated;
GRANT ALL ON public.org_sponsor_tiers TO service_role;

ALTER TABLE public.org_sponsor_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage sponsor tiers" ON public.org_sponsor_tiers
  FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Org members view sponsor tiers" ON public.org_sponsor_tiers
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE TRIGGER org_sponsor_tiers_updated_at
  BEFORE UPDATE ON public.org_sponsor_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.org_sponsors
  ADD COLUMN tier_id uuid NULL REFERENCES public.org_sponsor_tiers(id) ON DELETE SET NULL;

CREATE INDEX idx_org_sponsors_tier_id ON public.org_sponsors(tier_id);

CREATE OR REPLACE FUNCTION public.get_public_sponsors(_org_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _org uuid; _result jsonb;
BEGIN
  SELECT id INTO _org FROM public.organizations WHERE slug = _org_slug;
  IF _org IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x_tier_rank, x_display_order, x_name), '[]'::jsonb)
  INTO _result
  FROM (
    SELECT jsonb_build_object(
      'id', s.id, 'name', s.name,
      'tier', COALESCE(tt.name, s.tier),
      'tier_rank', COALESCE(tt.rank, s.tier_rank),
      'category', s.category, 'blurb', s.blurb, 'offer', s.offer,
      'logo_url', s.logo_url, 'image_urls', s.image_urls, 'website_url', s.website_url,
      'video_provider', s.video_provider, 'video_id', s.video_id
    ) AS x,
    COALESCE(tt.rank, s.tier_rank) AS x_tier_rank, s.display_order AS x_display_order, s.name AS x_name
    FROM public.org_sponsors s
    LEFT JOIN public.org_sponsor_tiers tt ON tt.id = s.tier_id
    WHERE s.organization_id = _org
      AND s.status = 'active'
      AND (s.ends_on IS NULL OR s.ends_on >= current_date)
  ) t;

  RETURN _result;
END;
$function$;