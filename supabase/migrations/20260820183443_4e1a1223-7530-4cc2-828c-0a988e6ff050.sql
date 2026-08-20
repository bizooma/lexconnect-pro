CREATE OR REPLACE FUNCTION public.create_organization_with_owner(_name text, _slug text, _kind org_kind, _plan subscription_plan, _max_users integer)
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

  -- Force starter tier + 7-day trial. The Stripe webhook will upgrade plan,
  -- seats_purchased, max_users, and status once payment is confirmed.
  INSERT INTO public.subscriptions (organization_id, plan, status, seats_purchased, max_users, trial_end)
  VALUES (new_org_id, 'starter'::subscription_plan, 'trialing', 1, 1, now() + interval '7 days');

  UPDATE public.profiles SET organization_id = new_org_id WHERE user_id = uid;

  RETURN new_org_id;
END $function$;