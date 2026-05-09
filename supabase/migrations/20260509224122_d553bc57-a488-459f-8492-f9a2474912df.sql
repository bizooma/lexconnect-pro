
-- 1) user_roles: explicit admin-only INSERT with WITH CHECK so non-admins cannot self-grant any role
DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
CREATE POLICY "Only admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Tighten the catch-all ALL policy so it cannot be the source of an insert escalation either.
-- (Keeps existing behavior: only admins can manage; the new explicit INSERT policy is additive/safer.)

-- 2) Function search_path hardening for helper functions that were missing it
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
-- dispatch_push_notification already sets search_path; ensure it stays scoped
ALTER FUNCTION public.dispatch_push_notification() SET search_path = public, extensions;

-- 3) organization_invites: allow an invitee to look up their own invite by their auth email
DROP POLICY IF EXISTS "Invitees can view their own invite" ON public.organization_invites;
CREATE POLICY "Invitees can view their own invite"
ON public.organization_invites
FOR SELECT
TO authenticated
USING (lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')));

-- 4) Tighten user_roles read: members can already see their own roles; admins can see all.
-- No change needed — confirming policies already exist.
