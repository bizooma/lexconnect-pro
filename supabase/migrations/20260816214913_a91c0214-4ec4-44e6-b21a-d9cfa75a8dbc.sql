CREATE OR REPLACE FUNCTION public.shares_org_with(_other_user uuid, _viewer uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members a
    JOIN public.organization_members b
      ON b.organization_id = a.organization_id
    WHERE a.user_id = _viewer      AND a.status = 'active'
      AND b.user_id = _other_user  AND b.status = 'active'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.shares_org_with(uuid, uuid) FROM anon;

ALTER POLICY "Profiles viewable by org members" ON public.profiles
  USING ((auth.uid() = user_id) OR shares_org_with(user_id, auth.uid()));

ALTER POLICY "Users insert their own profile in their org" ON public.profiles
  WITH CHECK (auth.uid() = user_id);

ALTER POLICY "Users update their own profile" ON public.profiles
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.redeem_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  inv public.organization_invites%ROWTYPE;
  uid uuid := auth.uid();
  user_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF user_email = '' THEN RAISE EXCEPTION 'No email claim on token'; END IF;
  SELECT * INTO inv FROM public.organization_invites WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found'; END IF;
  IF inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Invite already accepted'; END IF;
  IF inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN RAISE EXCEPTION 'Invite expired'; END IF;
  IF lower(inv.email) <> user_email THEN RAISE EXCEPTION 'Invite email does not match signed-in user'; END IF;
  INSERT INTO public.organization_members (organization_id, user_id, org_role, status, joined_at, invited_email)
  VALUES (inv.organization_id, uid, inv.org_role, 'active', now(), inv.email)
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET status = 'active', org_role = EXCLUDED.org_role;
  UPDATE public.organization_invites SET accepted_at = now() WHERE id = inv.id;
  UPDATE public.profiles SET organization_id = inv.organization_id
    WHERE user_id = uid AND organization_id IS NULL;
  RETURN inv.organization_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.redeem_invite_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  INSERT INTO public.organization_members (organization_id, user_id, org_role, status, joined_at)
  VALUES (ic.organization_id, uid, ic.role_assigned, 'active', now())
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET status = 'active', org_role = EXCLUDED.org_role;
  UPDATE public.invite_codes SET current_uses = current_uses + 1 WHERE id = ic.id;
  UPDATE public.profiles SET organization_id = ic.organization_id
    WHERE user_id = uid AND organization_id IS NULL;
  RETURN ic.organization_id;
END $function$;