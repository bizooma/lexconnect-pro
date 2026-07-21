ALTER TABLE public.website_custom_domains
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'site'
  CHECK (mode IN ('site','portal'));