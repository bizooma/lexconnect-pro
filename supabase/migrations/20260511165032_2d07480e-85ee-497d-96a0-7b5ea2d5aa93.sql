ALTER TABLE public.mentorships ADD COLUMN IF NOT EXISTS requested_by uuid;
-- Backfill: assume mentee initiated (existing convention)
UPDATE public.mentorships SET requested_by = mentee_id WHERE requested_by IS NULL;