REVOKE ALL ON public.org_events FROM anon;
REVOKE ALL ON public.event_rsvps FROM anon;
REVOKE INSERT, TRUNCATE, REFERENCES, TRIGGER ON public.event_rsvps FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.org_events FROM authenticated;