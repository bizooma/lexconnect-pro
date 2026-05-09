
-- 1. Extend messages with voice-note support
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS duration_seconds integer;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_kind_check CHECK (kind IN ('text','voice'));

-- 2. Voice-notes storage bucket (private, path = conversation_id/...)
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-notes', 'voice-notes', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Participants can read voice notes"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND public.is_conversation_participant(
        ((storage.foldername(name))[1])::uuid, auth.uid()
      )
);

CREATE POLICY "Participants can upload voice notes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'voice-notes'
  AND public.is_conversation_participant(
        ((storage.foldername(name))[1])::uuid, auth.uid()
      )
);

CREATE POLICY "Owner can delete their voice notes"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'voice-notes' AND owner = auth.uid());

-- 3. Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  related_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_unread_idx
  ON public.notifications (user_id, read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their notifications"
ON public.notifications FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- 4. Triggers

-- 4a. Mentorship requested (insert) -> notify mentor
CREATE OR REPLACE FUNCTION public.notify_mentorship_requested()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE mentee_name text;
BEGIN
  SELECT full_name INTO mentee_name FROM public.profiles WHERE user_id = NEW.mentee_id;
  IF NEW.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link, related_id)
    VALUES (
      NEW.mentor_id,
      'mentorship_request',
      'New mentorship request',
      COALESCE(mentee_name, 'A member') || ' requested mentorship.',
      '/app/dashboard',
      NEW.id
    );
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER mentorship_requested_notify
AFTER INSERT ON public.mentorships
FOR EACH ROW EXECUTE FUNCTION public.notify_mentorship_requested();

-- 4b. Mentorship status -> active : create conversation + notify both sides
CREATE OR REPLACE FUNCTION public.handle_mentorship_active()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  conv_id uuid;
  mentor_name text;
  mentee_name text;
BEGIN
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
    -- Find an existing conversation between the two users (a conversation with exactly these participants)
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
      INSERT INTO public.conversations DEFAULT VALUES RETURNING id INTO conv_id;
      INSERT INTO public.conversation_participants (conversation_id, user_id)
      VALUES (conv_id, NEW.mentor_id), (conv_id, NEW.mentee_id);
    END IF;

    SELECT full_name INTO mentor_name FROM public.profiles WHERE user_id = NEW.mentor_id;
    SELECT full_name INTO mentee_name FROM public.profiles WHERE user_id = NEW.mentee_id;

    INSERT INTO public.notifications (user_id, kind, title, body, link, related_id)
    VALUES
      (NEW.mentee_id, 'mentorship_accepted', 'Mentorship started',
       'You are now connected with ' || COALESCE(mentor_name,'your mentor') || '.',
       '/app/messages/' || conv_id::text, NEW.id),
      (NEW.mentor_id, 'mentorship_accepted', 'Mentorship started',
       'You are now connected with ' || COALESCE(mentee_name,'your mentee') || '.',
       '/app/messages/' || conv_id::text, NEW.id);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER mentorship_active_handler_ins
AFTER INSERT ON public.mentorships
FOR EACH ROW EXECUTE FUNCTION public.handle_mentorship_active();

CREATE TRIGGER mentorship_active_handler_upd
AFTER UPDATE ON public.mentorships
FOR EACH ROW EXECUTE FUNCTION public.handle_mentorship_active();

-- 4c. New message -> notify other participants + bump conversation last_message_at
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sender_name text;
  recipient uuid;
  preview text;
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  SELECT full_name INTO sender_name FROM public.profiles WHERE user_id = NEW.sender_id;
  preview := CASE WHEN NEW.kind = 'voice' THEN 'Sent a voice note'
                  ELSE LEFT(NEW.body, 80) END;
  FOR recipient IN
    SELECT user_id FROM public.conversation_participants
     WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id
  LOOP
    INSERT INTO public.notifications (user_id, kind, title, body, link, related_id)
    VALUES (recipient, 'message',
            COALESCE(sender_name,'Someone') || ' messaged you',
            preview,
            '/app/messages/' || NEW.conversation_id::text,
            NEW.id);
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER messages_after_insert
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.handle_new_message();

-- 4d. New meeting -> notify attendee
CREATE OR REPLACE FUNCTION public.notify_meeting_scheduled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE host_name text;
BEGIN
  IF NEW.host_id <> NEW.attendee_id THEN
    SELECT full_name INTO host_name FROM public.profiles WHERE user_id = NEW.host_id;
    INSERT INTO public.notifications (user_id, kind, title, body, link, related_id)
    VALUES (NEW.attendee_id, 'meeting',
            'New meeting scheduled',
            COALESCE(host_name,'Someone') || ' scheduled "' || NEW.title || '" with you.',
            '/app/meetings', NEW.id);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER meetings_after_insert
AFTER INSERT ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.notify_meeting_scheduled();

-- 5. Realtime publication for messaging + notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
