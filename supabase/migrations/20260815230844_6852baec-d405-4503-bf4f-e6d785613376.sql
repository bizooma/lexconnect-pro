ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS wellness_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lap_name text,
  ADD COLUMN IF NOT EXISTS lap_phone text,
  ADD COLUMN IF NOT EXISTS lap_url text;

CREATE TABLE public.org_wellness_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'resource' CHECK (kind IN ('resource','program')),
  title text NOT NULL CHECK (char_length(title) <= 120),
  description text CHECK (char_length(description) <= 1000),
  url text CHECK (url IS NULL OR url ~* '^https?://'),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 40),
  event_date timestamptz,
  display_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_wellness_resources TO authenticated;
GRANT ALL ON public.org_wellness_resources TO service_role;

ALTER TABLE public.org_wellness_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view wellness resources"
  ON public.org_wellness_resources FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Org admins manage wellness resources"
  ON public.org_wellness_resources FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

CREATE INDEX idx_org_wellness_resources_org ON public.org_wellness_resources(organization_id);
CREATE INDEX idx_org_wellness_resources_org_order ON public.org_wellness_resources(organization_id, display_order);

CREATE TRIGGER update_org_wellness_resources_updated_at
  BEFORE UPDATE ON public.org_wellness_resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ce_courses
  ADD COLUMN IF NOT EXISTS is_wellness boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wellness_credit_note text CHECK (wellness_credit_note IS NULL OR char_length(wellness_credit_note) <= 120);