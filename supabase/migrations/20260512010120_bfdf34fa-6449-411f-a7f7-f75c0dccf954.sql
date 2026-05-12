
DROP POLICY IF EXISTS "Members upload resources" ON public.resources;
CREATE POLICY "Members upload resources" ON public.resources FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by_user_id = auth.uid()
  AND public.is_org_member(organization_id, auth.uid())
  AND public.org_can_write(organization_id)
  AND (
    (visibility = 'organization' AND public.is_org_admin(organization_id, auth.uid()))
    OR visibility IN ('conversation','meeting','qa')
  )
);

DROP POLICY IF EXISTS "Org members view org resources" ON public.resources;
CREATE POLICY "Org members view org resources" ON public.resources FOR SELECT TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND (
    visibility = 'organization'
    OR uploaded_by_user_id = auth.uid()
    OR (visibility = 'conversation' AND EXISTS (
      SELECT 1 FROM public.message_resources mr
      JOIN public.messages m ON m.id = mr.message_id
      WHERE mr.resource_id = resources.id AND public.is_conversation_participant(m.conversation_id, auth.uid())
    ))
    OR (visibility = 'meeting' AND EXISTS (
      SELECT 1 FROM public.meeting_resources mtr
      JOIN public.meetings mt ON mt.id = mtr.meeting_id
      WHERE mtr.resource_id = resources.id AND (mt.host_id = auth.uid() OR mt.attendee_id = auth.uid())
    ))
    OR (visibility = 'qa' AND (
      EXISTS (SELECT 1 FROM public.qa_post_attachments qpa WHERE qpa.resource_id = resources.id AND public.is_org_member(qpa.organization_id, auth.uid()))
      OR EXISTS (SELECT 1 FROM public.qa_reply_attachments qra WHERE qra.resource_id = resources.id AND public.is_org_member(qra.organization_id, auth.uid()))
    ))
  )
);
