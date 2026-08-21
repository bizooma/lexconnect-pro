CREATE OR REPLACE FUNCTION public.get_event_rsvp_counts(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _result jsonb;
BEGIN
  IF NOT public.is_org_member(_org_id, auth.uid()) THEN
    RETURN '[]'::jsonb;
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'event_id', t.event_id,
    'going', t.going,
    'waitlist', t.waitlist
  )), '[]'::jsonb) INTO _result
  FROM (
    SELECT r.event_id,
           count(*) FILTER (WHERE r.status = 'going') AS going,
           count(*) FILTER (WHERE r.status = 'waitlist') AS waitlist
    FROM public.event_rsvps r
    WHERE r.organization_id = _org_id
    GROUP BY r.event_id
  ) t;
  RETURN _result;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_event_rsvp_counts(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_event_rsvp_counts(uuid) TO authenticated;