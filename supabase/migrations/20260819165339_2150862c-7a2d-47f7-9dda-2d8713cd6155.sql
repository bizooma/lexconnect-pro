CREATE TABLE public.org_sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) <= 120),
  tier text NOT NULL DEFAULT 'standard' CHECK (char_length(tier) <= 40),
  tier_rank integer NOT NULL DEFAULT 100,
  category text CHECK (category IS NULL OR char_length(category) <= 60),
  blurb text CHECK (blurb IS NULL OR char_length(blurb) <= 2000),
  offer text CHECK (offer IS NULL OR char_length(offer) <= 300),
  logo_url text CHECK (logo_url IS NULL OR logo_url ~* '^https://'),
  image_urls text[] NOT NULL DEFAULT '{}',
  website_url text CHECK (website_url IS NULL OR website_url ~* '^https?://'),
  video_provider text CHECK (video_provider IS NULL OR video_provider IN ('youtube','vimeo')),
  video_id text CHECK (video_id IS NULL OR video_id ~ '^[A-Za-z0-9_-]{5,20}$'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','hidden','lapsed')),
  starts_on date,
  ends_on date,
  display_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_sponsors TO authenticated;
GRANT ALL ON public.org_sponsors TO service_role;
ALTER TABLE public.org_sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage sponsors" ON public.org_sponsors FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Org members read active sponsors" ON public.org_sponsors FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) AND status = 'active');

CREATE INDEX idx_org_sponsors_org_status ON public.org_sponsors (organization_id, status);
CREATE INDEX idx_org_sponsors_org_category ON public.org_sponsors (organization_id, category);

CREATE TRIGGER org_sponsors_set_updated_at BEFORE UPDATE ON public.org_sponsors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.sponsor_in_org(_sponsor_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_sponsors s WHERE s.id = _sponsor_id AND s.organization_id = _org_id);
$$;

CREATE TABLE public.org_sponsor_admin (
  sponsor_id uuid PRIMARY KEY REFERENCES public.org_sponsors(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  pipeline text NOT NULL DEFAULT 'active' CHECK (pipeline IN ('prospect','committed','active','lapsed')),
  contact_name text CHECK (contact_name IS NULL OR char_length(contact_name) <= 120),
  contact_email text CHECK (contact_email IS NULL OR char_length(contact_email) <= 255),
  annual_amount_cents integer CHECK (annual_amount_cents IS NULL OR annual_amount_cents >= 0),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 5000),
  renewal_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_sponsor_admin TO authenticated;
GRANT ALL ON public.org_sponsor_admin TO service_role;
ALTER TABLE public.org_sponsor_admin ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage sponsor pipeline" ON public.org_sponsor_admin FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (
    public.is_org_admin(organization_id, auth.uid())
    AND public.sponsor_in_org(sponsor_id, organization_id)
  );

CREATE TRIGGER org_sponsor_admin_set_updated_at BEFORE UPDATE ON public.org_sponsor_admin
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.org_sponsor_metrics (
  sponsor_id uuid NOT NULL REFERENCES public.org_sponsors(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  day date NOT NULL DEFAULT current_date,
  views integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  PRIMARY KEY (sponsor_id, day)
);

ALTER TABLE public.org_sponsor_metrics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.org_sponsor_metrics FROM authenticated, anon;
GRANT ALL ON public.org_sponsor_metrics TO service_role;

CREATE OR REPLACE FUNCTION public.get_public_sponsors(_org_slug text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _result jsonb;
BEGIN
  SELECT id INTO _org FROM public.organizations WHERE slug = _org_slug;
  IF _org IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x_tier_rank, x_display_order, x_name), '[]'::jsonb)
  INTO _result
  FROM (
    SELECT jsonb_build_object(
      'id', s.id, 'name', s.name, 'tier', s.tier, 'tier_rank', s.tier_rank,
      'category', s.category, 'blurb', s.blurb, 'offer', s.offer,
      'logo_url', s.logo_url, 'image_urls', s.image_urls, 'website_url', s.website_url,
      'video_provider', s.video_provider, 'video_id', s.video_id
    ) AS x,
    s.tier_rank AS x_tier_rank, s.display_order AS x_display_order, s.name AS x_name
    FROM public.org_sponsors s
    WHERE s.organization_id = _org
      AND s.status = 'active'
      AND (s.ends_on IS NULL OR s.ends_on >= current_date)
  ) t;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_sponsors(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_sponsor_stats(_sponsor_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _result jsonb;
BEGIN
  SELECT organization_id INTO _org FROM public.org_sponsors WHERE id = _sponsor_id;
  IF _org IS NULL THEN RAISE EXCEPTION 'Sponsor not found'; END IF;
  IF NOT public.is_org_admin(_org, auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT jsonb_build_object(
    'views_30d', COALESCE(SUM(views) FILTER (WHERE day >= current_date - 29), 0),
    'clicks_30d', COALESCE(SUM(clicks) FILTER (WHERE day >= current_date - 29), 0),
    'views_total', COALESCE(SUM(views), 0),
    'clicks_total', COALESCE(SUM(clicks), 0)
  ) INTO _result
  FROM public.org_sponsor_metrics WHERE sponsor_id = _sponsor_id;

  RETURN _result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_sponsor_stats(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_sponsor_stats(uuid) TO authenticated;