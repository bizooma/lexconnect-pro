CREATE OR REPLACE FUNCTION public.has_white_label(_org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.organization_id = _org
      AND (
        (s.status = 'trialing' AND (s.trial_end IS NULL OR s.trial_end > now()))
        OR (s.plan = 'firm'::public.subscription_plan AND s.status IN ('active','grandfathered'))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.ai_monthly_limit(_org uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.organization_id = _org
        AND s.status = 'trialing'
        AND (s.trial_end IS NULL OR s.trial_end > now())
    ) THEN 300
    ELSE CASE (SELECT plan::text FROM public.subscriptions WHERE organization_id = _org LIMIT 1)
      WHEN 'pro' THEN 100
      WHEN 'firm' THEN 300
      ELSE 20
    END
  END;
$function$;

GRANT EXECUTE ON FUNCTION public.has_white_label(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_monthly_limit(uuid) TO authenticated, service_role;