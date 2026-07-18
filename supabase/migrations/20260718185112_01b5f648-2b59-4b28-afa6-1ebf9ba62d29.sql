
-- ============= PHASE 1: signup RPC — ignore client plan/seats, enforce trial =============

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_end timestamptz;

CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  _name text, _slug text, _kind org_kind, _plan subscription_plan, _max_users integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  new_org_id uuid;
  final_slug text := _slug;
  attempt int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- _plan and _max_users are IGNORED. Real entitlement flows from the Stripe
  -- webhook after payment. Every new org starts on the starter trial.
  PERFORM _plan; PERFORM _max_users;

  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = final_slug) LOOP
    attempt := attempt + 1;
    final_slug := _slug || '-' || attempt::text;
    IF attempt > 50 THEN RAISE EXCEPTION 'Could not allocate slug'; END IF;
  END LOOP;

  INSERT INTO public.organizations (name, slug, kind, created_by)
  VALUES (_name, final_slug, _kind, uid)
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, org_role, status, joined_at)
  VALUES (new_org_id, uid, 'owner', 'active', now());

  -- Force starter tier + 14-day trial. The Stripe webhook will upgrade plan,
  -- seats_purchased, max_users, and status once payment is confirmed.
  INSERT INTO public.subscriptions (organization_id, plan, status, seats_purchased, max_users, trial_end)
  VALUES (new_org_id, 'starter'::subscription_plan, 'trialing', 1, 1, now() + interval '14 days');

  UPDATE public.profiles SET organization_id = new_org_id WHERE user_id = uid;

  RETURN new_org_id;
END $function$;

-- ============= PHASE 1: org_can_write must respect trial expiry =============

CREATE OR REPLACE FUNCTION public.org_can_write(_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.organization_id = _org
      AND (
        -- Paid / manually-blessed plans always pass.
        (s.status IN ('active','grandfathered'))
        -- Trials only pass while trial_end is in the future.
        OR (s.status = 'trialing'
            AND (s.trial_end IS NULL OR s.trial_end > now()))
      )
  );
$function$;

-- ============= PHASE 3: push secret rotation via Vault + endpoint fix =============

-- Drop the compromised value from app_config. The old secret leaked in git
-- history is now invalidated; new value lives only in Vault + server env.
DELETE FROM public.app_config WHERE key = 'push_shared_secret';

-- Point trigger at the production domain, not the preview host.
UPDATE public.app_config
   SET value = 'https://lexguild.com/api/public/push/dispatch'
 WHERE key  = 'push_endpoint_url';
INSERT INTO public.app_config (key, value)
VALUES ('push_endpoint_url', 'https://lexguild.com/api/public/push/dispatch')
ON CONFLICT (key) DO NOTHING;

-- Rewrite dispatch trigger to read the secret from Vault at call time.
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
  SELECT decrypted_secret INTO shared_secret
    FROM vault.decrypted_secrets WHERE name = 'push_dispatch_secret';

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
  return NEW;
end;
$function$;
