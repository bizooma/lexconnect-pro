DO $$ BEGIN
  CREATE TYPE public.lrs_intake_status AS ENUM ('new','matched','assigned','closed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lrs_referral_status AS ENUM ('pending','accepted','declined','contacted','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.referral_panel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_areas text[] NOT NULL DEFAULT '{}',
  counties text[] NOT NULL DEFAULT '{}',
  languages text[] NOT NULL DEFAULT '{English}',
  capacity_status text NOT NULL DEFAULT 'available'
    CHECK (capacity_status IN ('available','limited','at_capacity')),
  max_active_referrals int,
  excluded_flags text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  application_status text NOT NULL DEFAULT 'pending'
    CHECK (application_status IN ('pending','approved','suspended')),
  last_assigned_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX referral_panel_org_active_idx ON public.referral_panel (organization_id, application_status, is_active);

CREATE TRIGGER referral_panel_updated_at
  BEFORE UPDATE ON public.referral_panel
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, UPDATE, DELETE ON public.referral_panel TO authenticated;
GRANT ALL ON public.referral_panel TO service_role;
REVOKE INSERT, TRUNCATE ON public.referral_panel FROM authenticated, anon;

ALTER TABLE public.referral_panel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Panel visible to org admins and the attorney"
  ON public.referral_panel FOR SELECT TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Org admins update panel rows"
  ON public.referral_panel FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Org admins delete panel rows"
  ON public.referral_panel FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()));

CREATE TABLE public.referral_intakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  intake_number text NOT NULL,
  caller_name text NOT NULL CHECK (char_length(caller_name) <= 200),
  caller_email text CHECK (caller_email IS NULL OR char_length(caller_email) <= 255),
  caller_phone text CHECK (caller_phone IS NULL OR char_length(caller_phone) <= 50),
  area_of_law text NOT NULL CHECK (char_length(area_of_law) <= 80),
  county text CHECK (county IS NULL OR char_length(county) <= 120),
  narrative text CHECK (narrative IS NULL OR char_length(narrative) <= 5000),
  urgency text NOT NULL DEFAULT 'normal' CHECK (urgency IN ('low','normal','high','urgent')),
  language_preference text DEFAULT 'English',
  status public.lrs_intake_status NOT NULL DEFAULT 'new',
  assigned_user_id uuid REFERENCES auth.users(id),
  source text NOT NULL DEFAULT 'public' CHECK (source IN ('public','staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, intake_number)
);

CREATE INDEX referral_intakes_org_status_idx ON public.referral_intakes (organization_id, status);
CREATE INDEX referral_intakes_org_area_county_idx ON public.referral_intakes (organization_id, area_of_law, county);

CREATE TRIGGER referral_intakes_updated_at
  BEFORE UPDATE ON public.referral_intakes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, UPDATE, DELETE ON public.referral_intakes TO authenticated;
GRANT ALL ON public.referral_intakes TO service_role;
REVOKE INSERT, TRUNCATE ON public.referral_intakes FROM authenticated, anon;

ALTER TABLE public.referral_intakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intakes visible to org admins and assigned attorney"
  ON public.referral_intakes FOR SELECT TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR assigned_user_id = auth.uid());

CREATE POLICY "Org admins update intakes"
  ON public.referral_intakes FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Org admins delete intakes"
  ON public.referral_intakes FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()));

CREATE TABLE public.referral_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  intake_id uuid NOT NULL REFERENCES public.referral_intakes(id) ON DELETE CASCADE,
  panel_user_id uuid NOT NULL REFERENCES auth.users(id),
  status public.lrs_referral_status NOT NULL DEFAULT 'pending',
  assigned_by uuid REFERENCES auth.users(id),
  response_note text CHECK (response_note IS NULL OR char_length(response_note) <= 2000),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

CREATE INDEX referral_assignments_panel_status_idx ON public.referral_assignments (panel_user_id, status);
CREATE INDEX referral_assignments_intake_idx ON public.referral_assignments (intake_id);

GRANT SELECT ON public.referral_assignments TO authenticated;
GRANT ALL ON public.referral_assignments TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.referral_assignments FROM authenticated, anon;

ALTER TABLE public.referral_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Assignments visible to the attorney and org admins"
  ON public.referral_assignments FOR SELECT TO authenticated
  USING (panel_user_id = auth.uid() OR public.is_org_admin(organization_id, auth.uid()));

CREATE TABLE public.referral_matching_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rule_name text NOT NULL,
  weight int NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, rule_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_matching_rules TO authenticated;
GRANT ALL ON public.referral_matching_rules TO service_role;
REVOKE TRUNCATE ON public.referral_matching_rules FROM authenticated, anon;

ALTER TABLE public.referral_matching_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage matching rules"
  ON public.referral_matching_rules FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.submit_referral_intake(
  _org_id uuid,
  _caller_name text,
  _caller_email text,
  _caller_phone text,
  _area_of_law text,
  _county text,
  _narrative text,
  _urgency text DEFAULT 'normal',
  _language_preference text DEFAULT 'English'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  _org public.organizations%ROWTYPE;
  _email text := lower(btrim(coalesce(_caller_email, '')));
  _recent int;
  _seq int;
  _number text;
  _row public.referral_intakes%ROWTYPE;
  _prefix text;
BEGIN
  SELECT * INTO _org FROM public.organizations WHERE id = _org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organization not found'; END IF;
  IF COALESCE(_org.paused, false) THEN RAISE EXCEPTION 'This referral service is not accepting requests'; END IF;

  IF btrim(coalesce(_caller_name, '')) = '' THEN RAISE EXCEPTION 'Your name is required'; END IF;
  IF btrim(coalesce(_area_of_law, '')) = '' THEN RAISE EXCEPTION 'Area of law is required'; END IF;
  IF _email <> '' AND _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Invalid email'; END IF;
  IF COALESCE(_urgency, 'normal') NOT IN ('low','normal','high','urgent') THEN
    RAISE EXCEPTION 'Invalid urgency';
  END IF;

  IF _email <> '' THEN
    SELECT count(*) INTO _recent FROM public.referral_intakes
      WHERE lower(caller_email) = _email AND created_at > now() - interval '1 hour';
    IF _recent >= 5 THEN
      RAISE EXCEPTION 'Too many referral requests. Please try again later.';
    END IF;
  END IF;

  _prefix := upper(regexp_replace(coalesce(_org.slug, 'ORG'), '[^a-zA-Z0-9]', '', 'g'));
  _prefix := left(coalesce(NULLIF(_prefix, ''), 'ORG'), 4);

  SELECT count(*) + 1 INTO _seq FROM public.referral_intakes
    WHERE organization_id = _org_id AND created_at::date = current_date;
  _number := _prefix || '-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(_seq::text, 4, '0');

  LOOP
    BEGIN
      INSERT INTO public.referral_intakes (
        organization_id, intake_number, caller_name, caller_email, caller_phone,
        area_of_law, county, narrative, urgency, language_preference, status, source
      ) VALUES (
        _org_id, _number, btrim(_caller_name), NULLIF(_email, ''), NULLIF(btrim(coalesce(_caller_phone,'')), ''),
        btrim(_area_of_law), NULLIF(btrim(coalesce(_county,'')), ''), NULLIF(btrim(coalesce(_narrative,'')), ''),
        COALESCE(_urgency, 'normal'), COALESCE(NULLIF(btrim(coalesce(_language_preference,'')), ''), 'English'),
        'new', 'public'
      ) RETURNING * INTO _row;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      _seq := _seq + 1;
      _number := _prefix || '-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(_seq::text, 4, '0');
    END;
  END LOOP;

  INSERT INTO public.notifications (user_id, organization_id, kind, title, body, link, related_id)
  SELECT m.user_id, _org_id, 'lrs_intake', 'New referral request',
         'A new ' || _row.area_of_law || ' referral request was submitted.',
         '/app/lrs/intakes', _row.id
    FROM public.organization_members m
   WHERE m.organization_id = _org_id AND m.status = 'active' AND m.org_role IN ('owner','admin');

  RETURN jsonb_build_object('intake_number', _row.intake_number, 'status', _row.status);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.submit_referral_intake(uuid,text,text,text,text,text,text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_referral_intake(uuid,text,text,text,text,text,text,text,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_to_referral_panel(
  _org_id uuid,
  _practice_areas text[],
  _counties text[],
  _languages text[]
) RETURNS public.referral_panel
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  _uid uuid := auth.uid();
  _row public.referral_panel;
  _name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_org_member(_org_id, _uid) THEN
    RAISE EXCEPTION 'You are not a member of this organization';
  END IF;

  INSERT INTO public.referral_panel (
    organization_id, user_id, practice_areas, counties, languages, application_status
  ) VALUES (
    _org_id, _uid, COALESCE(_practice_areas, '{}'), COALESCE(_counties, '{}'),
    COALESCE(NULLIF(_languages, '{}'), '{English}'), 'pending'
  )
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET practice_areas = COALESCE(EXCLUDED.practice_areas, public.referral_panel.practice_areas),
        counties = COALESCE(EXCLUDED.counties, public.referral_panel.counties),
        languages = COALESCE(EXCLUDED.languages, public.referral_panel.languages),
        updated_at = now()
  RETURNING * INTO _row;

  SELECT COALESCE(full_name, 'A member') INTO _name FROM public.profiles WHERE user_id = _uid;

  INSERT INTO public.notifications (user_id, organization_id, kind, title, body, link, related_id)
  SELECT m.user_id, _org_id, 'lrs_panel_application',
         COALESCE(_name, 'A member') || ' applied to the referral panel',
         NULL, '/app/lrs/panel', _row.id
    FROM public.organization_members m
   WHERE m.organization_id = _org_id AND m.status = 'active' AND m.org_role IN ('owner','admin');

  RETURN _row;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.apply_to_referral_panel(uuid,text[],text[],text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_to_referral_panel(uuid,text[],text[],text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_my_panel_profile(
  _org_id uuid,
  _practice_areas text[],
  _counties text[],
  _languages text[],
  _capacity_status text,
  _max_active_referrals int
) RETURNS public.referral_panel
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  _uid uuid := auth.uid();
  _row public.referral_panel;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _capacity_status IS NOT NULL AND _capacity_status NOT IN ('available','limited','at_capacity') THEN
    RAISE EXCEPTION 'Invalid capacity status';
  END IF;

  UPDATE public.referral_panel
     SET practice_areas = COALESCE(_practice_areas, practice_areas),
         counties = COALESCE(_counties, counties),
         languages = COALESCE(NULLIF(_languages, '{}'), languages),
         capacity_status = COALESCE(_capacity_status, capacity_status),
         max_active_referrals = COALESCE(_max_active_referrals, max_active_referrals),
         updated_at = now()
   WHERE organization_id = _org_id AND user_id = _uid
   RETURNING * INTO _row;

  IF NOT FOUND THEN RAISE EXCEPTION 'You are not on this referral panel'; END IF;
  RETURN _row;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.update_my_panel_profile(uuid,text[],text[],text[],text,int) FROM public;
GRANT EXECUTE ON FUNCTION public.update_my_panel_profile(uuid,text[],text[],text[],text,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.run_intake_matching(_intake_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  _uid uuid := auth.uid();
  _intake public.referral_intakes%ROWTYPE;
  _w_area int; _w_county int; _w_lang int; _w_cap int; _w_excl int;
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _intake FROM public.referral_intakes WHERE id = _intake_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Intake not found'; END IF;
  IF NOT public.is_org_admin(_intake.organization_id, _uid) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(max(weight) FILTER (WHERE rule_name = 'practice_area'), 40),
         COALESCE(max(weight) FILTER (WHERE rule_name = 'county'), 15),
         COALESCE(max(weight) FILTER (WHERE rule_name = 'language'), 10),
         COALESCE(max(weight) FILTER (WHERE rule_name = 'capacity'), -30),
         COALESCE(max(weight) FILTER (WHERE rule_name = 'exclusion'), -50)
    INTO _w_area, _w_county, _w_lang, _w_cap, _w_excl
    FROM public.referral_matching_rules
   WHERE organization_id = _intake.organization_id AND is_active;

  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'score')::int DESC), '[]'::jsonb) INTO _result
  FROM (
    SELECT jsonb_build_object(
      'user_id', p.user_id,
      'full_name', COALESCE(pr.full_name, 'Member'),
      'firm', pr.firm,
      'score', s.score,
      'breakdown', s.breakdown,
      'active_count', s.active_count,
      'capacity_status', p.capacity_status
    ) AS x
    FROM public.referral_panel p
    LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
    CROSS JOIN LATERAL (
      SELECT ac.active_count,
        (CASE WHEN _intake.area_of_law = ANY (p.practice_areas) THEN _w_area ELSE 0 END)
        + (CASE WHEN _intake.county IS NOT NULL AND _intake.county = ANY (p.counties) THEN _w_county ELSE 0 END)
        + (CASE WHEN COALESCE(_intake.language_preference, 'English') = ANY (p.languages) THEN _w_lang ELSE 0 END)
        + (CASE WHEN p.capacity_status = 'at_capacity'
                  OR (p.max_active_referrals IS NOT NULL AND ac.active_count >= p.max_active_referrals)
                THEN _w_cap ELSE 0 END)
        + (CASE WHEN _intake.area_of_law = ANY (p.excluded_flags) THEN _w_excl ELSE 0 END) AS score,
        jsonb_build_object(
          'practice_area', CASE WHEN _intake.area_of_law = ANY (p.practice_areas) THEN _w_area ELSE 0 END,
          'county', CASE WHEN _intake.county IS NOT NULL AND _intake.county = ANY (p.counties) THEN _w_county ELSE 0 END,
          'language', CASE WHEN COALESCE(_intake.language_preference, 'English') = ANY (p.languages) THEN _w_lang ELSE 0 END,
          'capacity', CASE WHEN p.capacity_status = 'at_capacity'
                             OR (p.max_active_referrals IS NOT NULL AND ac.active_count >= p.max_active_referrals)
                           THEN _w_cap ELSE 0 END,
          'exclusion', CASE WHEN _intake.area_of_law = ANY (p.excluded_flags) THEN _w_excl ELSE 0 END
        ) AS breakdown
      FROM (
        SELECT count(*)::int AS active_count
          FROM public.referral_assignments a
         WHERE a.panel_user_id = p.user_id
           AND a.organization_id = p.organization_id
           AND a.status IN ('pending','accepted','contacted')
      ) ac
    ) s
    WHERE p.organization_id = _intake.organization_id
      AND p.application_status = 'approved'
      AND p.is_active
  ) ranked;

  RETURN _result;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.run_intake_matching(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.run_intake_matching(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_referral(_intake_id uuid, _panel_user_id uuid)
RETURNS public.referral_assignments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  _uid uuid := auth.uid();
  _intake public.referral_intakes%ROWTYPE;
  _panel public.referral_panel%ROWTYPE;
  _row public.referral_assignments;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _intake FROM public.referral_intakes WHERE id = _intake_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Intake not found'; END IF;
  IF NOT public.is_org_admin(_intake.organization_id, _uid) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _panel FROM public.referral_panel
   WHERE organization_id = _intake.organization_id AND user_id = _panel_user_id FOR UPDATE;
  IF NOT FOUND OR _panel.application_status <> 'approved' OR NOT _panel.is_active THEN
    RAISE EXCEPTION 'Attorney is not an approved, active panel member';
  END IF;

  UPDATE public.referral_assignments
     SET status = 'closed', responded_at = COALESCE(responded_at, now())
   WHERE intake_id = _intake_id AND status = 'pending';

  INSERT INTO public.referral_assignments (
    organization_id, intake_id, panel_user_id, status, assigned_by
  ) VALUES (
    _intake.organization_id, _intake_id, _panel_user_id, 'pending', _uid
  ) RETURNING * INTO _row;

  UPDATE public.referral_intakes
     SET assigned_user_id = _panel_user_id, status = 'assigned', updated_at = now()
   WHERE id = _intake_id;

  UPDATE public.referral_panel SET last_assigned_at = now(), updated_at = now()
   WHERE id = _panel.id;

  INSERT INTO public.notifications (user_id, organization_id, kind, title, body, link, related_id)
  VALUES (_panel_user_id, _intake.organization_id, 'lrs_referral',
          'New client referral assigned to you',
          _intake.area_of_law || COALESCE(' - ' || _intake.county, ''),
          '/app/lrs/referrals', _row.id);

  RETURN _row;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.assign_referral(uuid,uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.assign_referral(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_referral_assignment(
  _assignment_id uuid, _status text, _note text DEFAULT NULL
) RETURNS public.referral_assignments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  _uid uuid := auth.uid();
  _row public.referral_assignments;
  _actor text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _status NOT IN ('accepted','declined','contacted') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  IF _note IS NOT NULL AND char_length(_note) > 2000 THEN RAISE EXCEPTION 'Note is too long'; END IF;

  SELECT * INTO _row FROM public.referral_assignments WHERE id = _assignment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Referral not found'; END IF;
  IF _row.panel_user_id <> _uid THEN
    RAISE EXCEPTION 'Only the assigned attorney can respond to this referral';
  END IF;

  UPDATE public.referral_assignments
     SET status = _status::public.lrs_referral_status,
         response_note = COALESCE(_note, response_note),
         responded_at = now()
   WHERE id = _assignment_id
   RETURNING * INTO _row;

  IF _status = 'declined' THEN
    UPDATE public.referral_intakes
       SET status = 'matched', assigned_user_id = NULL, updated_at = now()
     WHERE id = _row.intake_id;
  END IF;

  SELECT COALESCE(full_name, 'An attorney') INTO _actor FROM public.profiles WHERE user_id = _uid;

  INSERT INTO public.notifications (user_id, organization_id, kind, title, body, link, related_id)
  SELECT m.user_id, _row.organization_id, 'lrs_referral_update',
         COALESCE(_actor, 'An attorney') || ' ' || _status || ' a referral',
         _row.response_note, '/app/lrs/intakes', _row.id
    FROM public.organization_members m
   WHERE m.organization_id = _row.organization_id AND m.status = 'active'
     AND m.org_role IN ('owner','admin');

  RETURN _row;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.respond_to_referral_assignment(uuid,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.respond_to_referral_assignment(uuid,text,text) TO authenticated;