CREATE OR REPLACE FUNCTION public.notify_mentorship_requested()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  requester uuid;
  recipient uuid;
  requester_name text;
BEGIN
  IF NEW.status = 'pending' THEN
    requester := COALESCE(NEW.requested_by, NEW.mentee_id);
    recipient := CASE WHEN requester = NEW.mentor_id THEN NEW.mentee_id ELSE NEW.mentor_id END;
    SELECT full_name INTO requester_name FROM public.profiles WHERE user_id = requester;
    INSERT INTO public.notifications (user_id, organization_id, kind, title, body, link, related_id)
    VALUES (
      recipient,
      NEW.organization_id,
      'mentorship_request',
      'New mentorship request',
      COALESCE(requester_name, 'A member') || ' requested mentorship.',
      '/app/dashboard',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$function$;