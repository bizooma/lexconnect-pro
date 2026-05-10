DROP POLICY IF EXISTS "Users update their own profile" ON public.profiles;

CREATE POLICY "Users update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    organization_id IS NULL
    OR public.is_org_member(organization_id, auth.uid())
  )
);