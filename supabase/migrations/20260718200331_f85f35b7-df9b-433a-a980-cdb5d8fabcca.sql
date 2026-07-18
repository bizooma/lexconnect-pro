
-- Phase 3.5: tighten meetings INSERT policy — require active mentorship between host & attendee
DROP POLICY IF EXISTS "Members create meetings in their org" ON public.meetings;
CREATE POLICY "Members create meetings when connected"
  ON public.meetings FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id, auth.uid())
    AND public.org_can_write(organization_id)
    AND (auth.uid() = host_id OR auth.uid() = attendee_id)
    AND (
      -- Self-scheduled block (calendar hold, note-to-self)
      host_id = attendee_id
      -- Or the pair has an active mentorship (in either direction)
      OR EXISTS (
        SELECT 1 FROM public.mentorships m
        WHERE m.status = 'active'
          AND (
            (m.mentor_id = host_id AND m.mentee_id = attendee_id)
            OR (m.mentor_id = attendee_id AND m.mentee_id = host_id)
          )
      )
    )
  );

-- Phase 4.1: add interests column to profiles so onboarding can persist it
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}';
