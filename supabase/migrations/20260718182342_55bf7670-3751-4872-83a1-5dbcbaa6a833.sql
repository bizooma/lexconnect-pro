
-- ============ 1a. Invite redemption ============
CREATE OR REPLACE FUNCTION public.redeem_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.organization_invites%ROWTYPE;
  uid uuid := auth.uid();
  user_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF user_email = '' THEN RAISE EXCEPTION 'No email claim on token'; END IF;

  SELECT * INTO inv FROM public.organization_invites WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found'; END IF;
  IF inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Invite already accepted'; END IF;
  IF inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN RAISE EXCEPTION 'Invite expired'; END IF;
  IF lower(inv.email) <> user_email THEN RAISE EXCEPTION 'Invite email does not match signed-in user'; END IF;

  INSERT INTO public.organization_members (organization_id, user_id, org_role, status, joined_at, invited_email)
  VALUES (inv.organization_id, uid, inv.org_role, 'active', now(), inv.email)
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET status = 'active', org_role = EXCLUDED.org_role;

  UPDATE public.organization_invites SET accepted_at = now() WHERE id = inv.id;

  UPDATE public.profiles SET organization_id = inv.organization_id
    WHERE user_id = uid AND organization_id IS DISTINCT FROM inv.organization_id;

  RETURN inv.organization_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_invite(text) TO authenticated;

-- Drop the permissive self-insert policy
DROP POLICY IF EXISTS "Users can insert themselves as a member (used by accept-invite/create-org)" ON public.organization_members;

-- ============ 1b. Lock down CE member-write tables ============
-- Enrollments
DROP POLICY IF EXISTS "user manages own enrollment" ON public.ce_enrollments;
CREATE POLICY "user views own enrollment" ON public.ce_enrollments
  FOR SELECT USING (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.ce_enrollments FROM authenticated;

-- Lesson progress
DROP POLICY IF EXISTS "user manages own progress" ON public.ce_lesson_progress;
CREATE POLICY "user views own progress" ON public.ce_lesson_progress
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.ce_enrollments e
    WHERE e.id = ce_lesson_progress.enrollment_id AND e.user_id = auth.uid()
  ));
REVOKE INSERT, UPDATE, DELETE ON public.ce_lesson_progress FROM authenticated;

-- Quiz attempts
DROP POLICY IF EXISTS "user inserts own attempts" ON public.ce_quiz_attempts;
REVOKE INSERT, UPDATE, DELETE ON public.ce_quiz_attempts FROM authenticated;

-- ============ 1c. Tighten conversation participants ============
DROP POLICY IF EXISTS "Users can add participants to conversations they belong to" ON public.conversation_participants;
CREATE POLICY "Existing participants can add others" ON public.conversation_participants
  FOR INSERT WITH CHECK (public.is_conversation_participant(conversation_id, auth.uid()));
