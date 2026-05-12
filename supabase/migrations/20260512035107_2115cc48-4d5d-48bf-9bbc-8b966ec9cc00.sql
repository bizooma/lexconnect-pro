
-- 1. Config table for runtime-mutable settings (URLs, secrets, etc.)
CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read/write. Trigger functions use SECURITY DEFINER and bypass RLS.
CREATE POLICY "Admins can view app_config"
  ON public.app_config FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert app_config"
  ON public.app_config FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update app_config"
  ON public.app_config FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete app_config"
  ON public.app_config FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER app_config_set_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Seed current values
INSERT INTO public.app_config (key, value) VALUES
  ('push_endpoint_url', 'https://project--da8d11c5-efc5-4d07-91af-03b25eda27bb.lovable.app/api/public/push/dispatch'),
  ('push_shared_secret', 'dc704da71d8e3e56fe0725cc7535bfb2ddb2b908bdb6f1ce4b0f109bacc829ef')
ON CONFLICT (key) DO NOTHING;

-- 3. Replace trigger function to read from app_config at runtime
CREATE OR REPLACE FUNCTION public.dispatch_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
declare
  endpoint_url text;
  shared_secret text;
begin
  SELECT value INTO endpoint_url FROM public.app_config WHERE key = 'push_endpoint_url';
  SELECT value INTO shared_secret FROM public.app_config WHERE key = 'push_shared_secret';

  -- If either is missing, do not block the notification insert.
  if endpoint_url is null or shared_secret is null then
    return NEW;
  end if;

  perform net.http_post(
    url := endpoint_url,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-push-secret', shared_secret
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  return NEW;
exception when others then
  -- Never block notification insert if push fails
  return NEW;
end;
$function$;
