
-- 1. Add join_policy column to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS join_policy text NOT NULL DEFAULT 'invite_only'
    CHECK (join_policy IN ('invite_only','approval'));

-- 2. org_join_requests table
CREATE TABLE IF NOT EXISTS public.org_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS org_join_requests_pending_uniq
  ON public.org_join_requests(organization_id, user_id) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE ON public.org_join_requests TO authenticated;
GRANT ALL ON public.org_join_requests TO service_role;

ALTER TABLE public.org_join_requests ENABLE ROW LEVEL SECURITY;

-- Users insert only their own pending request
CREATE POLICY "user creates own pending join request"
  ON public.org_join_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- Users read their own requests
CREATE POLICY "user reads own join requests"
  ON public.org_join_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Org admins read requests for their org
CREATE POLICY "org admins read org join requests"
  ON public.org_join_requests FOR SELECT TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()));

-- Org admins update requests for their org (used for status changes via UI reads; approval goes through function)
CREATE POLICY "org admins update org join requests"
  ON public.org_join_requests FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

-- 3. approve_join_request SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.approve_join_request(_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.org_join_requests%ROWTYPE;
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO req FROM public.org_join_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Request is not pending'; END IF;

  IF NOT public.is_org_admin(req.organization_id, caller) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, org_role, status, joined_at)
  VALUES (req.organization_id, req.user_id, 'member', 'active', now())
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET status = 'active', org_role = COALESCE(public.organization_members.org_role, 'member');

  UPDATE public.org_join_requests
    SET status = 'approved', decided_at = now(), decided_by = caller
    WHERE id = _request_id;

  RETURN req.organization_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_join_request(uuid) TO authenticated;

-- 4. deny_join_request (mirrors approve)
CREATE OR REPLACE FUNCTION public.deny_join_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.org_join_requests%ROWTYPE;
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO req FROM public.org_join_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Request is not pending'; END IF;
  IF NOT public.is_org_admin(req.organization_id, caller) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.org_join_requests
    SET status = 'denied', decided_at = now(), decided_by = caller
    WHERE id = _request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deny_join_request(uuid) TO authenticated;
