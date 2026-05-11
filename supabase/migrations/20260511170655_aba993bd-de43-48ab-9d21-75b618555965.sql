CREATE OR REPLACE FUNCTION public.notify_mentorship_declined()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  requester uuid;
  responder uuid;
  responder_name text;
BEGIN
  IF NEW.status = 'declined' AND OLD.status IS DISTINCT FROM 'declined' THEN
    requester := COALESCE(NEW.requested_by, NEW.mentee_id);
    responder := CASE WHEN requester = NEW.mentor_id THEN NEW.mentee_id ELSE NEW.mentor_id END;
    SELECT full_name INTO responder_name FROM public.profiles WHERE user_id = responder;
    INSERT INTO public.notifications (user_id, organization_id, kind, title, body, link, related_id)
    VALUES (
      requester,
      NEW.organization_id,
      'mentorship_declined',
      'Mentorship request declined',
      COALESCE(responder_name, 'A member') || ' declined your mentorship request.',
      '/app/discover',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_mentorship_declined ON public.mentorships;
CREATE TRIGGER trg_notify_mentorship_declined
AFTER UPDATE ON public.mentorships
FOR EACH ROW
EXECUTE FUNCTION public.notify_mentorship_declined();