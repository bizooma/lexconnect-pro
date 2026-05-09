
-- 1. Branding + max_users
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS accent_color text,
  ADD COLUMN IF NOT EXISTS welcome_message text;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS max_users integer;

UPDATE public.subscriptions SET max_users = 9999 WHERE max_users IS NULL;

-- 2. invite_codes table
CREATE TABLE IF NOT EXISTS public.invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  role_assigned org_role NOT NULL DEFAULT 'member',
  expires_at timestamptz,
  max_uses integer,
  current_uses integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage invite codes"
  ON public.invite_codes FOR ALL TO authenticated
  USING (is_org_admin(organization_id, auth.uid()) OR has_role(auth.uid(), 'admin'))
  WITH CHECK (is_org_admin(organization_id, auth.uid()) OR has_role(auth.uid(), 'admin'));

-- 3. Public lookup function (does NOT leak the whole row)
CREATE OR REPLACE FUNCTION public.lookup_invite_code(_code text)
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  organization_logo text,
  role_assigned org_role,
  valid boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    o.id,
    o.name,
    o.logo_url,
    ic.role_assigned,
    (ic.active
       AND (ic.expires_at IS NULL OR ic.expires_at > now())
       AND (ic.max_uses IS NULL OR ic.current_uses < ic.max_uses)
    ) AS valid
  FROM public.invite_codes ic
  JOIN public.organizations o ON o.id = ic.organization_id
  WHERE ic.code = _code
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_invite_code(text) TO anon, authenticated;

-- 4. Atomic redeem function: validates and bumps current_uses, inserts membership.
CREATE OR REPLACE FUNCTION public.redeem_invite_code(_code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  ic public.invite_codes%ROWTYPE;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO ic FROM public.invite_codes WHERE code = _code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite code not found'; END IF;
  IF NOT ic.active THEN RAISE EXCEPTION 'Invite code is inactive'; END IF;
  IF ic.expires_at IS NOT NULL AND ic.expires_at <= now() THEN
    RAISE EXCEPTION 'Invite code has expired';
  END IF;
  IF ic.max_uses IS NOT NULL AND ic.current_uses >= ic.max_uses THEN
    RAISE EXCEPTION 'Invite code has reached its usage limit';
  END IF;

  -- Insert membership (idempotent on (org, user))
  INSERT INTO public.organization_members (organization_id, user_id, org_role, status, joined_at)
  VALUES (ic.organization_id, uid, ic.role_assigned, 'active', now())
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET status = 'active', org_role = EXCLUDED.org_role;

  UPDATE public.invite_codes SET current_uses = current_uses + 1 WHERE id = ic.id;

  -- Ensure profile has the org set
  UPDATE public.profiles SET organization_id = ic.organization_id
   WHERE user_id = uid AND organization_id IS DISTINCT FROM ic.organization_id;

  RETURN ic.organization_id;
END $$;

GRANT EXECUTE ON FUNCTION public.redeem_invite_code(text) TO authenticated;

-- 5. Update seat-limit trigger to honor max_users when set
CREATE OR REPLACE FUNCTION public.enforce_seat_limit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  cap int;
  used int;
BEGIN
  IF NEW.status NOT IN ('active','invited') THEN RETURN NEW; END IF;

  SELECT COALESCE(max_users, seats_purchased) INTO cap
    FROM public.subscriptions WHERE organization_id = NEW.organization_id;

  IF cap IS NULL THEN RETURN NEW; END IF;

  SELECT count(*) INTO used FROM public.organization_members
   WHERE organization_id = NEW.organization_id AND status IN ('active','invited');

  IF TG_OP = 'INSERT' AND used >= cap THEN
    RAISE EXCEPTION 'Seat limit reached (%). Upgrade your plan or remove a member.', cap;
  END IF;

  RETURN NEW;
END $$;

-- 6. Atomic create-org-with-owner function (used by /signup)
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  _name text,
  _slug text,
  _kind org_kind,
  _plan subscription_plan,
  _max_users int
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_org_id uuid;
  final_slug text := _slug;
  attempt int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Resolve slug collisions
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = final_slug) LOOP
    attempt := attempt + 1;
    final_slug := _slug || '-' || attempt::text;
    IF attempt > 50 THEN RAISE EXCEPTION 'Could not allocate slug'; END IF;
  END LOOP;

  INSERT INTO public.organizations (name, slug, kind, created_by)
  VALUES (_name, final_slug, _kind, uid)
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, org_role, status, joined_at)
  VALUES (new_org_id, uid, 'owner', 'active', now());

  INSERT INTO public.subscriptions (organization_id, plan, status, seats_purchased, max_users)
  VALUES (new_org_id, _plan, 'trialing', _max_users, _max_users);

  -- Move profile to the new org
  UPDATE public.profiles SET organization_id = new_org_id WHERE user_id = uid;

  RETURN new_org_id;
END $$;

GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(text, text, org_kind, subscription_plan, int) TO authenticated;
