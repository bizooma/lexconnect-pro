CREATE OR REPLACE FUNCTION public.notify_mentorship_requested()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  mentee_name text;
BEGIN
  SELECT full_name INTO mentee_name FROM public.profiles WHERE user_id = NEW.mentee_id;
  IF NEW.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, organization_id, kind, title, body, link, related_id)
    VALUES (
      NEW.mentor_id,
      NEW.organization_id,
      'mentorship_request',
      'New mentorship request',
      COALESCE(mentee_name, 'A member') || ' requested mentorship.',
      '/app/dashboard',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_meeting_scheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  host_name text;
BEGIN
  IF NEW.host_id <> NEW.attendee_id THEN
    SELECT full_name INTO host_name FROM public.profiles WHERE user_id = NEW.host_id;
    INSERT INTO public.notifications (user_id, organization_id, kind, title, body, link, related_id)
    VALUES (
      NEW.attendee_id,
      NEW.organization_id,
      'meeting',
      'New meeting scheduled',
      COALESCE(host_name,'Someone') || ' scheduled "' || NEW.title || '" with you.',
      '/app/meetings',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sender_name text;
  recipient uuid;
  preview text;
  conv_org uuid;
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id
  RETURNING organization_id INTO conv_org;

  SELECT full_name INTO sender_name FROM public.profiles WHERE user_id = NEW.sender_id;
  preview := CASE WHEN NEW.kind = 'voice' THEN 'Sent a voice note'
                  ELSE LEFT(NEW.body, 80) END;

  FOR recipient IN
    SELECT user_id FROM public.conversation_participants
    WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id
  LOOP
    INSERT INTO public.notifications (user_id, organization_id, kind, title, body, link, related_id)
    VALUES (
      recipient,
      conv_org,
      'message',
      COALESCE(sender_name,'Someone') || ' messaged you',
      preview,
      '/app/messages/' || NEW.conversation_id::text,
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_mentorship_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  conv_id uuid;
  mentor_name text;
  mentee_name text;
BEGIN
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
    SELECT c.id INTO conv_id
    FROM public.conversations c
    WHERE EXISTS (
        SELECT 1 FROM public.conversation_participants cp1
        WHERE cp1.conversation_id = c.id AND cp1.user_id = NEW.mentor_id
      )
      AND EXISTS (
        SELECT 1 FROM public.conversation_participants cp2
        WHERE cp2.conversation_id = c.id AND cp2.user_id = NEW.mentee_id
      )
    LIMIT 1;

    IF conv_id IS NULL THEN
      INSERT INTO public.conversations (organization_id)
      VALUES (NEW.organization_id)
      RETURNING id INTO conv_id;
      INSERT INTO public.conversation_participants (conversation_id, user_id)
      VALUES (conv_id, NEW.mentor_id), (conv_id, NEW.mentee_id);
    END IF;

    SELECT full_name INTO mentor_name FROM public.profiles WHERE user_id = NEW.mentor_id;
    SELECT full_name INTO mentee_name FROM public.profiles WHERE user_id = NEW.mentee_id;

    INSERT INTO public.notifications (user_id, organization_id, kind, title, body, link, related_id)
    VALUES
      (NEW.mentee_id, NEW.organization_id, 'mentorship_accepted', 'Mentorship started',
       'You are now connected with ' || COALESCE(mentor_name,'your mentor') || '.',
       '/app/messages/' || conv_id::text, NEW.id),
      (NEW.mentor_id, NEW.organization_id, 'mentorship_accepted', 'Mentorship started',
       'You are now connected with ' || COALESCE(mentee_name,'your mentee') || '.',
       '/app/messages/' || conv_id::text, NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;