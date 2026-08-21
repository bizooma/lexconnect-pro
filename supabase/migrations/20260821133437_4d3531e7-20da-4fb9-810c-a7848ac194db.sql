-- ============ member_directory_prefs ============
CREATE TABLE public.member_directory_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  directory_opt_out boolean NOT NULL DEFAULT false,
  accepting_referrals boolean NOT NULL DEFAULT true,
  headline text CHECK (headline IS NULL OR char_length(headline) <= 120),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_directory_prefs TO authenticated;
GRANT ALL ON public.member_directory_prefs TO service_role;
REVOKE TRUNCATE ON public.member_directory_prefs FROM anon, authenticated;

ALTER TABLE public.member_directory_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view directory prefs"
  ON public.member_directory_prefs FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Members insert their own directory prefs"
  ON public.member_directory_prefs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Members update their own directory prefs"
  ON public.member_directory_prefs FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Members delete their own directory prefs"
  ON public.member_directory_prefs FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.is_org_member(organization_id, auth.uid()));

CREATE TRIGGER member_directory_prefs_updated_at
  BEFORE UPDATE ON public.member_directory_prefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ member_referrals ============
CREATE TABLE public.member_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES auth.users(id),
  to_user_id uuid NOT NULL REFERENCES auth.users(id),
  client_name text NOT NULL CHECK (char_length(client_name) BETWEEN 1 AND 200),
  client_email text CHECK (client_email IS NULL OR char_length(client_email) <= 255),
  client_phone text CHECK (client_phone IS NULL OR char_length(client_phone) <= 50),
  matter_type text CHECK (matter_type IS NULL OR char_length(matter_type) <= 120),
  description text CHECK (description IS NULL OR char_length(description) <= 5000),
  urgency text NOT NULL DEFAULT 'normal' CHECK (urgency IN ('low','normal','high')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','closed')),
  response_note text CHECK (response_note IS NULL OR char_length(response_note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CHECK (from_user_id <> to_user_id)
);

CREATE INDEX member_referrals_to_status_idx ON public.member_referrals (to_user_id, status);
CREATE INDEX member_referrals_from_status_idx ON public.member_referrals (from_user_id, status);
CREATE INDEX member_referrals_org_idx ON public.member_referrals (organization_id);

GRANT SELECT ON public.member_referrals TO authenticated;
GRANT ALL ON public.member_referrals TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.member_referrals FROM anon, authenticated;

ALTER TABLE public.member_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referral parties can view their referrals"
  ON public.member_referrals FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- ============ definer functions ============
CREATE OR REPLACE FUNCTION public.get_org_directory(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF NOT public.is_org_member(_org_id, auth.uid()) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb ORDER BY d.full_name NULLS LAST), '[]'::jsonb)
  INTO _result
  FROM (
    SELECT
      p.user_id,
      p.full_name,
      p.firm,
      p.city,
      p.state,
      p.practice_areas,
      p.bar_admissions,
      p.years_experience,
      p.avatar_url,
      COALESCE(mdp.headline, p.headline) AS headline,
      COALESCE(mdp.accepting_referrals, true) AS accepting_referrals
    FROM public.organization_members om
    JOIN public.profiles p ON p.user_id = om.user_id
    LEFT JOIN public.member_directory_prefs mdp
      ON mdp.user_id = om.user_id AND mdp.organization_id = _org_id
    WHERE om.organization_id = _org_id
      AND om.status = 'active'
      AND om.user_id IS NOT NULL
      AND COALESCE(mdp.directory_opt_out, false) = false
  ) d;

  RETURN _result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_org_directory(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_org_directory(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_member_referral(
  _to_user_id uuid,
  _org_id uuid,
  _client_name text,
  _client_email text DEFAULT NULL,
  _client_phone text DEFAULT NULL,
  _matter_type text DEFAULT NULL,
  _description text DEFAULT NULL,
  _urgency text DEFAULT 'normal'
)
RETURNS public.member_referrals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.member_referrals;
  _sender text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_org_member(_org_id, _uid) THEN
    RAISE EXCEPTION 'You are not a member of this organization';
  END IF;
  IF NOT public.is_org_member(_org_id, _to_user_id) THEN
    RAISE EXCEPTION 'Recipient is not a member of this organization';
  END IF;
  IF _to_user_id = _uid THEN
    RAISE EXCEPTION 'You cannot refer a matter to yourself';
  END IF;
  IF _client_name IS NULL OR btrim(_client_name) = '' THEN
    RAISE EXCEPTION 'Client name is required';
  END IF;

  INSERT INTO public.member_referrals (
    organization_id, from_user_id, to_user_id, client_name, client_email,
    client_phone, matter_type, description, urgency, status
  ) VALUES (
    _org_id, _uid, _to_user_id, btrim(_client_name), _client_email,
    _client_phone, _matter_type, _description, COALESCE(_urgency, 'normal'), 'pending'
  ) RETURNING * INTO _row;

  SELECT COALESCE(full_name, 'A member') INTO _sender FROM public.profiles WHERE user_id = _uid;

  INSERT INTO public.notifications (user_id, organization_id, kind, title, body, link, related_id)
  VALUES (
    _to_user_id, _org_id, 'referral_received',
    'New referral from ' || COALESCE(_sender, 'a member'),
    COALESCE(_row.matter_type, 'New client referral'),
    '/app/referrals', _row.id
  );

  RETURN _row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_member_referral(uuid, uuid, text, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.send_member_referral(uuid, uuid, text, text, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_member_referral(
  _referral_id uuid,
  _status text,
  _response_note text DEFAULT NULL
)
RETURNS public.member_referrals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.member_referrals;
  _actor text;
  _target uuid;
  _title text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _row FROM public.member_referrals WHERE id = _referral_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referral not found';
  END IF;

  IF _status IN ('accepted','declined') THEN
    IF _row.to_user_id <> _uid THEN
      RAISE EXCEPTION 'Only the recipient can accept or decline this referral';
    END IF;
    _target := _row.from_user_id;
  ELSIF _status = 'closed' THEN
    IF _row.from_user_id <> _uid THEN
      RAISE EXCEPTION 'Only the sender can close this referral';
    END IF;
    _target := _row.to_user_id;
  ELSE
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.member_referrals
     SET status = _status,
         response_note = COALESCE(_response_note, response_note),
         responded_at = now()
   WHERE id = _referral_id
   RETURNING * INTO _row;

  SELECT COALESCE(full_name, 'A member') INTO _actor FROM public.profiles WHERE user_id = _uid;
  _title := COALESCE(_actor, 'A member') || ' ' || _status || ' your referral';

  INSERT INTO public.notifications (user_id, organization_id, kind, title, body, link, related_id)
  VALUES (
    _target, _row.organization_id, 'referral_update', _title,
    _row.response_note, '/app/referrals', _row.id
  );

  RETURN _row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.respond_to_member_referral(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.respond_to_member_referral(uuid, text, text) TO authenticated;