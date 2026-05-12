CREATE OR REPLACE FUNCTION public.enforce_seat_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cap int;
  used int;
  was_seat_consuming boolean := false;
BEGIN
  IF NEW.status NOT IN ('active','invited') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    was_seat_consuming := OLD.status IN ('active','invited');
    -- Already counted toward the cap; nothing to enforce.
    IF was_seat_consuming THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT COALESCE(max_users, seats_purchased) INTO cap
    FROM public.subscriptions WHERE organization_id = NEW.organization_id;

  IF cap IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO used FROM public.organization_members
   WHERE organization_id = NEW.organization_id
     AND status IN ('active','invited')
     AND (TG_OP <> 'UPDATE' OR id <> NEW.id);

  IF used >= cap THEN
    RAISE EXCEPTION 'Seat limit reached (%). Upgrade your plan or remove a member.', cap;
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS enforce_seat_limit_trg ON public.organization_members;
CREATE TRIGGER enforce_seat_limit_trg
BEFORE INSERT OR UPDATE OF status ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_seat_limit();