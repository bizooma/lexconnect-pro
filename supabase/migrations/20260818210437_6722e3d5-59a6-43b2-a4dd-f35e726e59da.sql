-- allowed dimensions
CREATE OR REPLACE FUNCTION public.wellness_dimensions()
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT ARRAY['physical_activity','stress_management','sleep','nutrition','social_connection','career_satisfaction','mindfulness','community_service','work_life_boundaries','professional_development']::text[]
$$;

-- 1. challenges
CREATE TABLE public.wellness_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) <= 120),
  description text CHECK (description IS NULL OR char_length(description) <= 2000),
  dimensions text[] NOT NULL DEFAULT '{}' CHECK (dimensions <@ ARRAY['physical_activity','stress_management','sleep','nutrition','social_connection','career_satisfaction','mindfulness','community_service','work_life_boundaries','professional_development']::text[]),
  kind text NOT NULL CHECK (kind IN ('daily_checkin','cumulative','pledge')),
  goal_value integer CHECK (goal_value IS NULL OR goal_value > 0),
  unit text CHECK (unit IS NULL OR char_length(unit) <= 30),
  template_key text,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_challenges TO authenticated;
GRANT ALL ON public.wellness_challenges TO service_role;
ALTER TABLE public.wellness_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage challenges" ON public.wellness_challenges
FOR ALL TO authenticated
USING (public.is_org_admin(organization_id, auth.uid()))
WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Org members view challenges" ON public.wellness_challenges
FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE TRIGGER wellness_challenges_updated_at
BEFORE UPDATE ON public.wellness_challenges
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_wellness_challenges_org ON public.wellness_challenges(organization_id, status);

-- helper to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.challenge_in_org(_challenge_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.wellness_challenges wc
    WHERE wc.id = _challenge_id AND wc.organization_id = _org_id AND wc.status = 'active'
  )
$$;
REVOKE ALL ON FUNCTION public.challenge_in_org(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.challenge_in_org(uuid, uuid) TO authenticated, service_role;

-- 2. participants
CREATE TABLE public.wellness_challenge_participants (
  challenge_id uuid NOT NULL REFERENCES public.wellness_challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (challenge_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_challenge_participants TO authenticated;
GRANT ALL ON public.wellness_challenge_participants TO service_role;
ALTER TABLE public.wellness_challenge_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own participation select" ON public.wellness_challenge_participants
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Own participation insert" ON public.wellness_challenge_participants
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.is_org_member(organization_id, auth.uid())
  AND public.challenge_in_org(challenge_id, organization_id)
);

CREATE POLICY "Own participation update" ON public.wellness_challenge_participants
FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Own participation delete" ON public.wellness_challenge_participants
FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 3. check-ins
CREATE TABLE public.wellness_challenge_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.wellness_challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  occurred_on date NOT NULL DEFAULT current_date,
  value integer NOT NULL DEFAULT 1 CHECK (value >= 1 AND value <= 100000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id, occurred_on)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_challenge_checkins TO authenticated;
GRANT ALL ON public.wellness_challenge_checkins TO service_role;
ALTER TABLE public.wellness_challenge_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own checkins select" ON public.wellness_challenge_checkins
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Own checkins insert" ON public.wellness_challenge_checkins
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.is_org_member(organization_id, auth.uid())
  AND public.challenge_in_org(challenge_id, organization_id)
  AND EXISTS (
    SELECT 1 FROM public.wellness_challenge_participants p
    WHERE p.challenge_id = wellness_challenge_checkins.challenge_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Own checkins update" ON public.wellness_challenge_checkins
FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Own checkins delete" ON public.wellness_challenge_checkins
FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_wellness_checkins_challenge ON public.wellness_challenge_checkins(challenge_id);

-- 4. member focus areas
CREATE TABLE public.wellness_preferences (
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  dimension text NOT NULL CHECK (dimension IN ('physical_activity','stress_management','sleep','nutrition','social_connection','career_satisfaction','mindfulness','community_service','work_life_boundaries','professional_development')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, organization_id, dimension)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_preferences TO authenticated;
GRANT ALL ON public.wellness_preferences TO service_role;
ALTER TABLE public.wellness_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own wellness preferences" ON public.wellness_preferences
FOR ALL TO authenticated
USING (user_id = auth.uid() AND public.is_org_member(organization_id, auth.uid()))
WITH CHECK (user_id = auth.uid() AND public.is_org_member(organization_id, auth.uid()));

-- 5. challenge stats
CREATE OR REPLACE FUNCTION public.get_challenge_stats(_challenge_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _org uuid;
  _result jsonb;
BEGIN
  SELECT organization_id INTO _org FROM public.wellness_challenges WHERE id = _challenge_id;
  IF _org IS NULL THEN RAISE EXCEPTION 'Challenge not found'; END IF;
  IF NOT public.is_org_member(_org, auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT jsonb_build_object(
    'participants', (SELECT count(*) FROM public.wellness_challenge_participants p WHERE p.challenge_id = _challenge_id),
    'community_total', COALESCE((SELECT sum(c.value) FROM public.wellness_challenge_checkins c WHERE c.challenge_id = _challenge_id), 0),
    'my_total', COALESCE((SELECT sum(c.value) FROM public.wellness_challenge_checkins c WHERE c.challenge_id = _challenge_id AND c.user_id = auth.uid()), 0),
    'my_days', (SELECT count(*) FROM public.wellness_challenge_checkins c WHERE c.challenge_id = _challenge_id AND c.user_id = auth.uid()),
    'joined', EXISTS (SELECT 1 FROM public.wellness_challenge_participants p WHERE p.challenge_id = _challenge_id AND p.user_id = auth.uid()),
    'completed', EXISTS (SELECT 1 FROM public.wellness_challenge_participants p WHERE p.challenge_id = _challenge_id AND p.user_id = auth.uid() AND p.completed_at IS NOT NULL)
  ) INTO _result;

  RETURN _result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_challenge_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_challenge_stats(uuid) TO authenticated;

-- 6. interest aggregates (admin only, min 10 members)
CREATE OR REPLACE FUNCTION public.get_wellness_interest_aggregates(_org uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _n integer;
  _aggs jsonb;
BEGIN
  IF NOT public.is_org_admin(_org, auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT count(DISTINCT user_id) INTO _n FROM public.wellness_preferences WHERE organization_id = _org;

  IF _n < 10 THEN
    RETURN jsonb_build_object('members', _n, 'minimum', 10, 'aggregates', NULL);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('dimension', d.dimension, 'count', d.c) ORDER BY d.c DESC), '[]'::jsonb)
  INTO _aggs
  FROM (
    SELECT dimension, count(*)::int AS c
    FROM public.wellness_preferences
    WHERE organization_id = _org
    GROUP BY dimension
  ) d;

  RETURN jsonb_build_object('members', _n, 'minimum', 10, 'aggregates', _aggs);
END;
$$;
REVOKE ALL ON FUNCTION public.get_wellness_interest_aggregates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_wellness_interest_aggregates(uuid) TO authenticated;

-- 7. additive column
ALTER TABLE public.org_wellness_resources
  ADD COLUMN dimension text NULL
  CHECK (dimension IS NULL OR dimension IN ('physical_activity','stress_management','sleep','nutrition','social_connection','career_satisfaction','mindfulness','community_service','work_life_boundaries','professional_development'));
