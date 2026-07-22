
-- 1) org_contacts
CREATE TABLE public.org_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  phone text,
  external_ref text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX org_contacts_org_email_lower_key
  ON public.org_contacts (organization_id, lower(email));
CREATE INDEX org_contacts_org_idx ON public.org_contacts(organization_id);
CREATE INDEX org_contacts_user_idx ON public.org_contacts(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_contacts TO authenticated;
GRANT ALL ON public.org_contacts TO service_role;

ALTER TABLE public.org_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage contacts"
  ON public.org_contacts FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

CREATE TRIGGER update_org_contacts_updated_at
  BEFORE UPDATE ON public.org_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: verify a contact belongs to an org (SECURITY DEFINER avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.contact_in_org(_contact_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_contacts
    WHERE id = _contact_id AND organization_id = _org_id
  );
$$;

-- 2) org_contact_tags
CREATE TABLE public.org_contact_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.org_contacts(id) ON DELETE CASCADE,
  tag text NOT NULL CHECK (char_length(tag) <= 40),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contact_id, tag)
);
CREATE INDEX org_contact_tags_org_idx ON public.org_contact_tags(organization_id);
CREATE INDEX org_contact_tags_contact_idx ON public.org_contact_tags(contact_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_contact_tags TO authenticated;
GRANT ALL ON public.org_contact_tags TO service_role;

ALTER TABLE public.org_contact_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage contact tags"
  ON public.org_contact_tags FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (
    public.is_org_admin(organization_id, auth.uid())
    AND public.contact_in_org(contact_id, organization_id)
  );

-- 3) org_contact_notes
CREATE TABLE public.org_contact_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.org_contacts(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) <= 5000),
  author_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX org_contact_notes_org_idx ON public.org_contact_notes(organization_id);
CREATE INDEX org_contact_notes_contact_idx ON public.org_contact_notes(contact_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_contact_notes TO authenticated;
GRANT ALL ON public.org_contact_notes TO service_role;

ALTER TABLE public.org_contact_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage contact notes"
  ON public.org_contact_notes FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (
    public.is_org_admin(organization_id, auth.uid())
    AND public.contact_in_org(contact_id, organization_id)
  );

-- 4) org_contact_interactions
CREATE TABLE public.org_contact_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.org_contacts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('call','email','meeting','event','other')),
  note text CHECK (note IS NULL OR char_length(note) <= 5000),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX org_contact_interactions_org_idx ON public.org_contact_interactions(organization_id);
CREATE INDEX org_contact_interactions_contact_idx ON public.org_contact_interactions(contact_id);
CREATE INDEX org_contact_interactions_occurred_idx ON public.org_contact_interactions(occurred_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_contact_interactions TO authenticated;
GRANT ALL ON public.org_contact_interactions TO service_role;

ALTER TABLE public.org_contact_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage contact interactions"
  ON public.org_contact_interactions FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (
    public.is_org_admin(organization_id, auth.uid())
    AND public.contact_in_org(contact_id, organization_id)
  );

-- 5) org_follow_ups
CREATE TABLE public.org_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.org_contacts(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) <= 200),
  due_at timestamptz,
  assigned_to uuid,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','dismissed')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX org_follow_ups_org_idx ON public.org_follow_ups(organization_id);
CREATE INDEX org_follow_ups_contact_idx ON public.org_follow_ups(contact_id);
CREATE INDEX org_follow_ups_due_idx ON public.org_follow_ups(due_at);
CREATE INDEX org_follow_ups_assigned_idx ON public.org_follow_ups(assigned_to);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_follow_ups TO authenticated;
GRANT ALL ON public.org_follow_ups TO service_role;

ALTER TABLE public.org_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage follow ups"
  ON public.org_follow_ups FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (
    public.is_org_admin(organization_id, auth.uid())
    AND public.contact_in_org(contact_id, organization_id)
  );
