
-- Efficient linker: joins org_contacts to auth.users by lowercased email
-- for active members of _org, backfilling user_id in a single statement.
-- Verifies the CALLER is an org admin of _org.
CREATE OR REPLACE FUNCTION public.link_org_contacts(_org uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  updated_count integer := 0;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_org_admin(_org, caller) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  WITH candidates AS (
    SELECT c.id AS contact_id, u.id AS user_id
    FROM public.org_contacts c
    JOIN auth.users u ON lower(u.email) = lower(c.email)
    JOIN public.organization_members m
      ON m.user_id = u.id
     AND m.organization_id = _org
     AND m.status = 'active'
    WHERE c.organization_id = _org
      AND c.user_id IS NULL
      AND c.email IS NOT NULL
  ), upd AS (
    UPDATE public.org_contacts c
       SET user_id = cand.user_id
      FROM candidates cand
     WHERE c.id = cand.contact_id
    RETURNING 1
  )
  SELECT count(*) INTO updated_count FROM upd;

  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.link_org_contacts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_org_contacts(uuid) TO authenticated;
