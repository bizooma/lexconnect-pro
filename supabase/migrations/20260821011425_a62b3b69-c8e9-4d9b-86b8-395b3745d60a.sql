ALTER TABLE public.website_custom_domains
  ADD COLUMN IF NOT EXISTS lovable_connected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lovable_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_notified_at timestamptz;