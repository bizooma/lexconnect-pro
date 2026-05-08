ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS communication_prefs text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS meeting_cadence text;