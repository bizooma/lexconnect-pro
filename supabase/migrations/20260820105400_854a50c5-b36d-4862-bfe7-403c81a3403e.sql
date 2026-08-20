CREATE TABLE public.org_site_profile (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  founded_year integer CHECK (founded_year IS NULL OR founded_year BETWEEN 1700 AND 2100),
  region text CHECK (region IS NULL OR char_length(region) <= 120),
  audience text CHECK (audience IS NULL OR audience IN ('members','public','both')),
  tone text CHECK (tone IS NULL OR tone IN ('professional','warm','modern')),
  primary_goal text CHECK (primary_goal IS NULL OR char_length(primary_goal) <= 200),
  programs text[] NOT NULL DEFAULT '{}',
  contact jsonb NOT NULL DEFAULT '{}',
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_site_profile TO authenticated;
GRANT ALL ON public.org_site_profile TO service_role;

ALTER TABLE public.org_site_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site profile readable by website editors"
  ON public.org_site_profile FOR SELECT TO authenticated
  USING (public.can_edit_website(organization_id, auth.uid()));

CREATE POLICY "site profile insert by org admins"
  ON public.org_site_profile FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

CREATE POLICY "site profile update by org admins"
  ON public.org_site_profile FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

CREATE POLICY "site profile delete by org admins"
  ON public.org_site_profile FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()));

CREATE TRIGGER update_org_site_profile_updated_at
  BEFORE UPDATE ON public.org_site_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();