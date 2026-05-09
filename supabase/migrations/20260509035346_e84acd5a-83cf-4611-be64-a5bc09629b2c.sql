
-- =========================================================
-- 1. ENUMS
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.org_kind AS ENUM ('firm', 'bar_association');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.org_member_status AS ENUM ('active', 'invited', 'removed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('trialing','active','past_due','canceled','incomplete','grandfathered');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_plan AS ENUM ('starter','pro','firm');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =========================================================
-- 2. TABLES
-- =========================================================
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  kind public.org_kind NOT NULL DEFAULT 'firm',
  logo_url text,
  website text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid,
  org_role public.org_role NOT NULL DEFAULT 'member',
  status public.org_member_status NOT NULL DEFAULT 'active',
  invited_email text,
  invited_by uuid,
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);

CREATE TABLE public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  org_role public.org_role NOT NULL DEFAULT 'member',
  invited_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_org_invites_org ON public.organization_invites(organization_id);
CREATE INDEX idx_org_invites_email ON public.organization_invites(lower(email));

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  status public.subscription_status NOT NULL DEFAULT 'incomplete',
  plan public.subscription_plan NOT NULL DEFAULT 'starter',
  seats_purchased integer NOT NULL DEFAULT 1,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 3. SCOPE EXISTING TABLES
-- =========================================================
ALTER TABLE public.profiles      ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.mentorships   ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.conversations ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.meetings      ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- =========================================================
-- 4. BACKFILL DEFAULT ORG
-- =========================================================
DO $$
DECLARE
  default_org_id uuid;
  seat_count int;
BEGIN
  INSERT INTO public.organizations (name, slug, kind)
  VALUES ('LexGuild', 'lexguild', 'bar_association')
  RETURNING id INTO default_org_id;

  -- Add every existing profile as a member (admin role from user_roles becomes owner)
  INSERT INTO public.organization_members (organization_id, user_id, org_role, status, joined_at)
  SELECT
    default_org_id,
    p.user_id,
    CASE WHEN ur.role = 'admin' THEN 'owner'::public.org_role ELSE 'member'::public.org_role END,
    'active',
    now()
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = 'admin'
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  UPDATE public.profiles      SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.mentorships   SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.conversations SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.meetings      SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.notifications SET organization_id = default_org_id WHERE organization_id IS NULL;

  SELECT count(*) INTO seat_count FROM public.organization_members WHERE organization_id = default_org_id;

  INSERT INTO public.subscriptions (organization_id, status, plan, seats_purchased)
  VALUES (default_org_id, 'grandfathered', 'firm', GREATEST(seat_count, 50));
END $$;

-- Now lock organization_id NOT NULL where it makes sense
ALTER TABLE public.profiles      ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.mentorships   ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.meetings      ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN organization_id SET NOT NULL;

-- =========================================================
-- 5. HELPER FUNCTIONS (SECURITY DEFINER)
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org AND user_id = _user AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_org uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org AND user_id = _user
      AND status = 'active' AND org_role IN ('owner','admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.org_can_write(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE organization_id = _org
      AND status IN ('trialing','active','grandfathered')
  );
$$;

-- =========================================================
-- 6. RLS — NEW TABLES
-- =========================================================
ALTER TABLE public.organizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Org admins can update their organization"
  ON public.organizations FOR UPDATE TO authenticated
  USING (public.is_org_admin(id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Members can view their org membership rows"
  ON public.organization_members FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Users can insert themselves as a member (used by accept-invite/create-org)"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Org admins can add members"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Org admins can update members"
  ON public.organization_members FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Org admins can remove members"
  ON public.organization_members FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Org admins manage invites"
  ON public.organization_invites FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Org members can view their subscription"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- subscriptions are written by service role (webhook); no direct user writes.

-- =========================================================
-- 7. RLS — REWRITE EXISTING POLICIES TO BE ORG-SCOPED
-- =========================================================
-- profiles
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Profiles viewable by org members"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Users insert their own profile in their org"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Users update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- mentorships
DROP POLICY IF EXISTS "Admins can create mentorships for any users" ON public.mentorships;
DROP POLICY IF EXISTS "Admins can update any mentorships" ON public.mentorships;
DROP POLICY IF EXISTS "Admins can view all mentorships" ON public.mentorships;
DROP POLICY IF EXISTS "Members can request mentorships they participate in" ON public.mentorships;
DROP POLICY IF EXISTS "Participants can update their mentorships" ON public.mentorships;
DROP POLICY IF EXISTS "Participants can view their mentorships" ON public.mentorships;

CREATE POLICY "Org members view mentorships in their org"
  ON public.mentorships FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR ((auth.uid() = mentor_id OR auth.uid() = mentee_id) AND public.is_org_member(organization_id, auth.uid()))
    OR public.is_org_admin(organization_id, auth.uid())
  );

CREATE POLICY "Members create mentorships in their org"
  ON public.mentorships FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id, auth.uid())
    AND public.org_can_write(organization_id)
    AND (auth.uid() = mentor_id OR auth.uid() = mentee_id OR public.is_org_admin(organization_id, auth.uid()))
  );

CREATE POLICY "Participants or org admins update mentorships"
  ON public.mentorships FOR UPDATE TO authenticated
  USING (
    public.org_can_write(organization_id)
    AND (auth.uid() = mentor_id OR auth.uid() = mentee_id OR public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))
  );

-- conversations
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Participants can update their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Participants can view their conversations" ON public.conversations;

CREATE POLICY "Participants can view conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_participant(id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Authenticated org members create conversations"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_org_member(organization_id, auth.uid()) AND public.org_can_write(organization_id));

CREATE POLICY "Participants update conversations"
  ON public.conversations FOR UPDATE TO authenticated
  USING (public.is_conversation_participant(id, auth.uid()) AND public.org_can_write(organization_id));

-- meetings
DROP POLICY IF EXISTS "Host or attendee can delete their meetings" ON public.meetings;
DROP POLICY IF EXISTS "Host or attendee can update their meetings" ON public.meetings;
DROP POLICY IF EXISTS "Host or attendee can view their meetings" ON public.meetings;
DROP POLICY IF EXISTS "Members can create meetings they participate in" ON public.meetings;

CREATE POLICY "Host or attendee view meetings"
  ON public.meetings FOR SELECT TO authenticated
  USING ((auth.uid() = host_id OR auth.uid() = attendee_id) AND public.is_org_member(organization_id, auth.uid())
         OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Members create meetings in their org"
  ON public.meetings FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND public.org_can_write(organization_id)
              AND (auth.uid() = host_id OR auth.uid() = attendee_id));

CREATE POLICY "Host or attendee update meetings"
  ON public.meetings FOR UPDATE TO authenticated
  USING ((auth.uid() = host_id OR auth.uid() = attendee_id) AND public.org_can_write(organization_id));

CREATE POLICY "Host or attendee delete meetings"
  ON public.meetings FOR DELETE TO authenticated
  USING (auth.uid() = host_id OR auth.uid() = attendee_id);

-- notifications
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;

CREATE POLICY "Users view their notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update their notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- messages: tighten with org_can_write through conversation
DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
CREATE POLICY "Participants send messages when org can write"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_conversation_participant(conversation_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND public.org_can_write(c.organization_id)
    )
  );

-- =========================================================
-- 8. SEAT ENFORCEMENT TRIGGER
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_seat_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cap int;
  used int;
BEGIN
  IF NEW.status NOT IN ('active','invited') THEN
    RETURN NEW;
  END IF;

  SELECT seats_purchased INTO cap FROM public.subscriptions
   WHERE organization_id = NEW.organization_id;

  IF cap IS NULL THEN
    RETURN NEW; -- no subscription row yet (e.g. first owner) — allow
  END IF;

  SELECT count(*) INTO used FROM public.organization_members
   WHERE organization_id = NEW.organization_id AND status IN ('active','invited');

  IF TG_OP = 'INSERT' AND used >= cap THEN
    RAISE EXCEPTION 'Seat limit reached (%). Upgrade your plan or remove a member.', cap;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_enforce_seat_limit
  BEFORE INSERT OR UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_seat_limit();

-- =========================================================
-- 9. AUTO-UPDATE updated_at on new tables
-- =========================================================
CREATE TRIGGER trg_orgs_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_subs_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
