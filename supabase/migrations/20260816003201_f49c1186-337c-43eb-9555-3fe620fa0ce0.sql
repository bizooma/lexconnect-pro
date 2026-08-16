CREATE TABLE public.wellness_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) <= 120),
  questions jsonb NOT NULL,
  opens_at timestamptz NOT NULL DEFAULT now(),
  closes_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_surveys TO authenticated;
GRANT ALL ON public.wellness_surveys TO service_role;
ALTER TABLE public.wellness_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage wellness surveys"
  ON public.wellness_surveys FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Members view wellness surveys"
  ON public.wellness_surveys FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX idx_wellness_surveys_org ON public.wellness_surveys(organization_id);

-- Anonymous answers: no user identity, no precise timestamp
CREATE TABLE public.wellness_survey_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.wellness_surveys(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  answers jsonb NOT NULL,
  submitted_on date NOT NULL DEFAULT current_date
);

ALTER TABLE public.wellness_survey_answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wellness_survey_answers FROM authenticated;
REVOKE ALL ON public.wellness_survey_answers FROM anon;
GRANT ALL ON public.wellness_survey_answers TO service_role;
CREATE INDEX idx_wellness_answers_survey ON public.wellness_survey_answers(survey_id);

CREATE TABLE public.wellness_survey_participation (
  survey_id uuid NOT NULL REFERENCES public.wellness_surveys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (survey_id, user_id)
);

GRANT SELECT ON public.wellness_survey_participation TO authenticated;
GRANT ALL ON public.wellness_survey_participation TO service_role;
ALTER TABLE public.wellness_survey_participation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see only their own participation"
  ON public.wellness_survey_participation FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.submit_wellness_response(_survey_id uuid, _answers jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  s public.wellness_surveys%ROWTYPE;
  qids text[];
  akeys text[];
  k text;
  v jsonb;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO s FROM public.wellness_surveys WHERE id = _survey_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Survey not found'; END IF;

  IF NOT (now() >= s.opens_at AND now() <= COALESCE(s.closes_at, 'infinity'::timestamptz)) THEN
    RAISE EXCEPTION 'Survey is not open';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = s.organization_id AND user_id = caller AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not a member';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.wellness_survey_participation
    WHERE survey_id = _survey_id AND user_id = caller
  ) THEN
    RAISE EXCEPTION 'Already responded';
  END IF;

  IF jsonb_typeof(_answers) <> 'object' THEN
    RAISE EXCEPTION 'Invalid answers';
  END IF;

  SELECT array_agg(q->>'id' ORDER BY q->>'id') INTO qids
  FROM jsonb_array_elements(s.questions) q;

  IF qids IS NULL OR array_length(qids, 1) IS NULL THEN
    RAISE EXCEPTION 'Survey has no questions';
  END IF;

  SELECT array_agg(key ORDER BY key) INTO akeys FROM jsonb_object_keys(_answers) key;

  IF akeys IS DISTINCT FROM qids THEN
    RAISE EXCEPTION 'Invalid answers';
  END IF;

  FOR k, v IN SELECT key, value FROM jsonb_each(_answers) LOOP
    IF jsonb_typeof(v) <> 'number' THEN RAISE EXCEPTION 'Invalid answers'; END IF;
    IF (v::text)::numeric <> trunc((v::text)::numeric) THEN RAISE EXCEPTION 'Invalid answers'; END IF;
    IF (v::text)::numeric < 1 OR (v::text)::numeric > 5 THEN RAISE EXCEPTION 'Invalid answers'; END IF;
  END LOOP;

  INSERT INTO public.wellness_survey_participation (survey_id, user_id)
  VALUES (_survey_id, caller);

  INSERT INTO public.wellness_survey_answers (survey_id, organization_id, answers)
  VALUES (_survey_id, s.organization_id, _answers);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_wellness_response(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_wellness_response(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_wellness_results(_survey_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.wellness_surveys%ROWTYPE;
  n int;
  res jsonb;
BEGIN
  SELECT * INTO s FROM public.wellness_surveys WHERE id = _survey_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Survey not found'; END IF;

  IF NOT public.is_org_admin(s.organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT count(*) INTO n FROM public.wellness_survey_answers WHERE survey_id = _survey_id;

  IF n < 10 THEN
    RETURN jsonb_build_object('responses', n, 'minimum', 10, 'results', NULL);
  END IF;

  WITH q AS (
    SELECT elem->>'id' AS qid FROM jsonb_array_elements(s.questions) elem
  ),
  vals AS (
    SELECT q.qid, ((a.answers->>q.qid))::numeric AS val
    FROM public.wellness_survey_answers a
    CROSS JOIN q
    WHERE a.survey_id = _survey_id AND a.answers ? q.qid
  ),
  agg AS (
    SELECT q.qid,
      jsonb_build_array(
        count(*) FILTER (WHERE v.val = 1),
        count(*) FILTER (WHERE v.val = 2),
        count(*) FILTER (WHERE v.val = 3),
        count(*) FILTER (WHERE v.val = 4),
        count(*) FILTER (WHERE v.val = 5)
      ) AS counts,
      round(COALESCE(avg(v.val), 0), 2) AS mean
    FROM q LEFT JOIN vals v ON v.qid = q.qid
    GROUP BY q.qid
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', qid, 'counts', counts, 'mean', mean) ORDER BY qid), '[]'::jsonb)
  INTO res FROM agg;

  RETURN jsonb_build_object('responses', n, 'minimum', 10, 'results', res);
END;
$$;

REVOKE ALL ON FUNCTION public.get_wellness_results(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_wellness_results(uuid) TO authenticated;