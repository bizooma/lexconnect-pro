-- a. monthly counter
CREATE TABLE public.org_ai_usage (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period text NOT NULL,
  monthly_used integer NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, period)
);
GRANT SELECT ON public.org_ai_usage TO authenticated;
GRANT ALL ON public.org_ai_usage TO service_role;
ALTER TABLE public.org_ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Website editors can view AI usage"
  ON public.org_ai_usage FOR SELECT TO authenticated
  USING (public.can_edit_website(organization_id, auth.uid()));

-- b. purchased credits
CREATE TABLE public.org_ai_credits (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.org_ai_credits TO authenticated;
GRANT ALL ON public.org_ai_credits TO service_role;
ALTER TABLE public.org_ai_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Website editors can view AI credits"
  ON public.org_ai_credits FOR SELECT TO authenticated
  USING (public.can_edit_website(organization_id, auth.uid()));

-- d. token columns
ALTER TABLE public.website_ai_generations
  ADD COLUMN prompt_tokens integer,
  ADD COLUMN completion_tokens integer,
  ADD COLUMN total_tokens integer,
  ADD COLUMN charged_to text CHECK (charged_to IS NULL OR charged_to IN ('monthly','purchased'));

-- 2. plan limit
CREATE OR REPLACE FUNCTION public.ai_monthly_limit(_org uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE (SELECT plan::text FROM public.subscriptions WHERE organization_id = _org LIMIT 1)
    WHEN 'pro' THEN 100
    WHEN 'firm' THEN 300
    ELSE 20
  END;
$$;

-- 3. reserve
CREATE OR REPLACE FUNCTION public.reserve_ai_generation(_org uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _period text := to_char(now(), 'YYYY-MM');
  _limit integer;
  _used integer;
  _balance integer;
BEGIN
  IF NOT public.can_edit_website(_org, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to generate for this organization';
  END IF;

  _limit := public.ai_monthly_limit(_org);

  INSERT INTO public.org_ai_usage (organization_id, period, monthly_used)
  VALUES (_org, _period, 0)
  ON CONFLICT (organization_id, period) DO NOTHING;

  SELECT monthly_used INTO _used
  FROM public.org_ai_usage
  WHERE organization_id = _org AND period = _period
  FOR UPDATE;

  IF _used < _limit THEN
    UPDATE public.org_ai_usage
      SET monthly_used = monthly_used + 1
      WHERE organization_id = _org AND period = _period
      RETURNING monthly_used INTO _used;
    SELECT COALESCE(balance, 0) INTO _balance FROM public.org_ai_credits WHERE organization_id = _org;
    RETURN jsonb_build_object('ok', true, 'source', 'monthly', 'monthly_used', _used,
      'monthly_limit', _limit, 'purchased_balance', COALESCE(_balance, 0));
  END IF;

  INSERT INTO public.org_ai_credits (organization_id, balance)
  VALUES (_org, 0) ON CONFLICT (organization_id) DO NOTHING;

  SELECT balance INTO _balance FROM public.org_ai_credits
  WHERE organization_id = _org FOR UPDATE;

  IF COALESCE(_balance, 0) > 0 THEN
    UPDATE public.org_ai_credits
      SET balance = balance - 1, updated_at = now()
      WHERE organization_id = _org
      RETURNING balance INTO _balance;
    RETURN jsonb_build_object('ok', true, 'source', 'purchased', 'monthly_used', _used,
      'monthly_limit', _limit, 'purchased_balance', _balance);
  END IF;

  RETURN jsonb_build_object('ok', false, 'source', NULL, 'monthly_used', _used,
    'monthly_limit', _limit, 'purchased_balance', 0);
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_ai_generation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_ai_generation(uuid) TO authenticated;

-- 4. release
CREATE OR REPLACE FUNCTION public.release_ai_generation(_org uuid, _source text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _period text := to_char(now(), 'YYYY-MM');
BEGIN
  IF NOT public.can_edit_website(_org, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _source = 'monthly' THEN
    UPDATE public.org_ai_usage
      SET monthly_used = greatest(0, monthly_used - 1)
      WHERE organization_id = _org AND period = _period;
  ELSIF _source = 'purchased' THEN
    INSERT INTO public.org_ai_credits (organization_id, balance)
    VALUES (_org, 1)
    ON CONFLICT (organization_id)
    DO UPDATE SET balance = public.org_ai_credits.balance + 1, updated_at = now();
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.release_ai_generation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_ai_generation(uuid, text) TO authenticated;

-- 5. usage snapshot
CREATE OR REPLACE FUNCTION public.get_ai_usage(_org uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _period text := to_char(now(), 'YYYY-MM');
  _limit integer;
  _used integer;
  _balance integer;
BEGIN
  IF NOT public.can_edit_website(_org, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  _limit := public.ai_monthly_limit(_org);
  SELECT COALESCE(monthly_used, 0) INTO _used FROM public.org_ai_usage
    WHERE organization_id = _org AND period = _period;
  _used := COALESCE(_used, 0);
  SELECT COALESCE(balance, 0) INTO _balance FROM public.org_ai_credits WHERE organization_id = _org;
  _balance := COALESCE(_balance, 0);
  RETURN jsonb_build_object(
    'monthly_used', _used,
    'monthly_limit', _limit,
    'monthly_remaining', greatest(0, _limit - _used),
    'purchased_balance', _balance,
    'total_remaining', greatest(0, _limit - _used) + _balance,
    'period', _period,
    'resets_on', to_char((date_trunc('month', now()) + interval '1 month')::date, 'YYYY-MM-DD')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_ai_usage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_usage(uuid) TO authenticated;