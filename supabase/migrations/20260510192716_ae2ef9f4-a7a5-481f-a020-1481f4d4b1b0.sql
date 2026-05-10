
-- Enums
CREATE TYPE public.resource_category AS ENUM (
  'mentorship_guide','cle','template','checklist','professional_development','meeting','other'
);
CREATE TYPE public.resource_visibility AS ENUM ('organization','conversation','meeting');

-- Tables (create all first, then policies)
CREATE TABLE public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  uploaded_by_user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  category public.resource_category NOT NULL DEFAULT 'other',
  visibility public.resource_visibility NOT NULL DEFAULT 'organization',
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_resources_org ON public.resources(organization_id);
CREATE INDEX idx_resources_org_visibility ON public.resources(organization_id, visibility);
CREATE INDEX idx_resources_category ON public.resources(category);

CREATE TABLE public.message_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, resource_id)
);
CREATE INDEX idx_msg_resources_message ON public.message_resources(message_id);
CREATE INDEX idx_msg_resources_resource ON public.message_resources(resource_id);

CREATE TABLE public.meeting_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, resource_id)
);
CREATE INDEX idx_meeting_resources_meeting ON public.meeting_resources(meeting_id);
CREATE INDEX idx_meeting_resources_resource ON public.meeting_resources(resource_id);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_resource()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.file_size > 26214400 THEN
    RAISE EXCEPTION 'Resource exceeds 25MB limit';
  END IF;
  IF NEW.file_type NOT IN (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg','image/png'
  ) THEN
    RAISE EXCEPTION 'Unsupported file type: %', NEW.file_type;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_resource
BEFORE INSERT OR UPDATE ON public.resources
FOR EACH ROW EXECUTE FUNCTION public.validate_resource();

-- RLS
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view org resources"
ON public.resources FOR SELECT TO authenticated
USING (
  is_org_member(organization_id, auth.uid())
  AND (
    visibility = 'organization'
    OR uploaded_by_user_id = auth.uid()
    OR (visibility = 'conversation' AND EXISTS (
      SELECT 1 FROM public.message_resources mr
      JOIN public.messages m ON m.id = mr.message_id
      WHERE mr.resource_id = resources.id
        AND is_conversation_participant(m.conversation_id, auth.uid())
    ))
    OR (visibility = 'meeting' AND EXISTS (
      SELECT 1 FROM public.meeting_resources mtr
      JOIN public.meetings mt ON mt.id = mtr.meeting_id
      WHERE mtr.resource_id = resources.id
        AND (mt.host_id = auth.uid() OR mt.attendee_id = auth.uid())
    ))
  )
);

CREATE POLICY "Members upload resources"
ON public.resources FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by_user_id = auth.uid()
  AND is_org_member(organization_id, auth.uid())
  AND org_can_write(organization_id)
  AND (
    (visibility = 'organization' AND is_org_admin(organization_id, auth.uid()))
    OR visibility IN ('conversation','meeting')
  )
);

CREATE POLICY "Admins or uploader delete resources"
ON public.resources FOR DELETE TO authenticated
USING (is_org_admin(organization_id, auth.uid()) OR uploaded_by_user_id = auth.uid());

CREATE POLICY "Admins update resources"
ON public.resources FOR UPDATE TO authenticated
USING (is_org_admin(organization_id, auth.uid()))
WITH CHECK (is_org_admin(organization_id, auth.uid()));

-- message_resources policies
CREATE POLICY "Participants view message resources"
ON public.message_resources FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.messages m
  WHERE m.id = message_resources.message_id
    AND is_conversation_participant(m.conversation_id, auth.uid())
));

CREATE POLICY "Sender attaches to own message"
ON public.message_resources FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.messages m
  WHERE m.id = message_resources.message_id AND m.sender_id = auth.uid()
));

CREATE POLICY "Sender removes attachment"
ON public.message_resources FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.messages m
  WHERE m.id = message_resources.message_id AND m.sender_id = auth.uid()
));

-- meeting_resources policies
CREATE POLICY "Host or attendee view meeting resources"
ON public.meeting_resources FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.meetings mt
  WHERE mt.id = meeting_resources.meeting_id
    AND (mt.host_id = auth.uid() OR mt.attendee_id = auth.uid())
));

CREATE POLICY "Host or attendee attach meeting resources"
ON public.meeting_resources FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.meetings mt
  WHERE mt.id = meeting_resources.meeting_id
    AND (mt.host_id = auth.uid() OR mt.attendee_id = auth.uid())
));

CREATE POLICY "Host or attendee remove meeting resources"
ON public.meeting_resources FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.meetings mt
  WHERE mt.id = meeting_resources.meeting_id
    AND (mt.host_id = auth.uid() OR mt.attendee_id = auth.uid())
));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('resources', 'resources', false);

CREATE POLICY "Org members read resource files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'resources'
  AND is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Org members upload resource files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'resources'
  AND is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  AND auth.uid() = owner
);

CREATE POLICY "Owner or admin delete resource files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'resources'
  AND (auth.uid() = owner OR is_org_admin(((storage.foldername(name))[1])::uuid, auth.uid()))
);
