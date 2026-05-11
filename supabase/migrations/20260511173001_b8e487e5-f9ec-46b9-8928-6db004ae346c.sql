ALTER TABLE public.mentorships
  DROP CONSTRAINT IF EXISTS mentorships_mentor_id_mentee_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS mentorships_one_open_pair_per_org_idx
  ON public.mentorships (organization_id, mentor_id, mentee_id)
  WHERE status IN ('pending', 'active');