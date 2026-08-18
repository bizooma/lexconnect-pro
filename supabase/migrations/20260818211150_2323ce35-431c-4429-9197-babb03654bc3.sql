DROP POLICY IF EXISTS "Own participation update" ON public.wellness_challenge_participants;
CREATE POLICY "Own participation update" ON public.wellness_challenge_participants
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_org_member(organization_id, auth.uid())
    AND public.challenge_in_org(challenge_id, organization_id)
  );

DROP POLICY IF EXISTS "Own checkins update" ON public.wellness_challenge_checkins;
CREATE POLICY "Own checkins update" ON public.wellness_challenge_checkins
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_org_member(organization_id, auth.uid())
    AND public.challenge_in_org(challenge_id, organization_id)
    AND EXISTS (
      SELECT 1 FROM public.wellness_challenge_participants p
      WHERE p.challenge_id = wellness_challenge_checkins.challenge_id
        AND p.user_id = auth.uid()
    )
  );