-- ============ org_events ============
CREATE TABLE public.org_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  slug text CHECK (slug IS NULL OR slug ~ '^[a-z0-9][a-z0-9-]*$'),
  description text CHECK (description IS NULL OR char_length(description) <= 20000),
  location_name text CHECK (location_name IS NULL OR char_length(location_name) <= 200),
  location_address text CHECK (location_address IS NULL OR char_length(location_address) <= 500),
  is_virtual boolean NOT NULL DEFAULT false,
  virtual_url text CHECK (virtual_url IS NULL OR char_length(virtual_url) <= 2000),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  timezone text NOT NULL DEFAULT 'America/New_York',
  capacity integer CHECK (capacity IS NULL OR capacity > 0),
  visibility text NOT NULL DEFAULT 'members' CHECK (visibility IN ('public','members')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','cancelled')),
  rsvp_enabled boolean NOT NULL DEFAULT true,
  cover_image_url text CHECK (cover_image_url IS NULL OR char_length(cover_image_url) <= 2000),
  -- Reserved paid-ticketing hooks (unused in v1)
  registration_mode text NOT NULL DEFAULT 'rsvp' CHECK (registration_mode IN ('rsvp','ticketed')),
  price_cents integer CHECK (price_cents IS NULL OR price_cents >= 0),
  currency text NOT NULL DEFAULT 'usd',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_events TO authenticated;
GRANT ALL ON public.org_events TO service_role;
REVOKE TRUNCATE ON public.org_events FROM authenticated, anon;

ALTER TABLE public.org_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage events" ON public.org_events FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Org members read published events" ON public.org_events FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) AND status = 'published');

CREATE UNIQUE INDEX idx_org_events_org_slug ON public.org_events (organization_id, slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_org_events_org_starts ON public.org_events (organization_id, starts_at);
CREATE INDEX idx_org_events_org_status_visibility ON public.org_events (organization_id, status, visibility);

CREATE TRIGGER org_events_set_updated_at BEFORE UPDATE ON public.org_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-slug from title, unique per organization
CREATE OR REPLACE FUNCTION public.org_events_set_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE base text; candidate text; n int := 0;
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    base := regexp_replace(lower(NEW.title), '[^a-z0-9]+', '-', 'g');
    base := btrim(base, '-');
    IF base = '' THEN base := 'event'; END IF;
    base := left(base, 80);
    candidate := base;
    WHILE EXISTS (
      SELECT 1 FROM public.org_events e
      WHERE e.organization_id = NEW.organization_id AND e.slug = candidate AND e.id <> NEW.id
    ) LOOP
      n := n + 1;
      candidate := base || '-' || n::text;
      IF n > 200 THEN candidate := base || '-' || replace(gen_random_uuid()::text, '-', ''); EXIT; END IF;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER org_events_slug BEFORE INSERT OR UPDATE OF title, slug ON public.org_events
  FOR EACH ROW EXECUTE FUNCTION public.org_events_set_slug();

-- ============ event_rsvps ============
CREATE TABLE public.event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.org_events(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  guest_name text CHECK (guest_name IS NULL OR char_length(guest_name) <= 120),
  guest_email text CHECK (guest_email IS NULL OR char_length(guest_email) <= 255),
  status text NOT NULL DEFAULT 'going' CHECK (status IN ('going','waitlist','cancelled')),
  payment_status text NOT NULL DEFAULT 'none' CHECK (payment_status IN ('none','pending','paid','refunded')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- No INSERT grant: all RSVP creation flows through rsvp_to_event().
GRANT SELECT, UPDATE, DELETE ON public.event_rsvps TO authenticated;
GRANT ALL ON public.event_rsvps TO service_role;
REVOKE INSERT, TRUNCATE ON public.event_rsvps FROM authenticated, anon;

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own rsvp" ON public.event_rsvps FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Org admins read rsvps" ON public.event_rsvps FOR SELECT TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Org admins update rsvps" ON public.event_rsvps FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Org admins delete rsvps" ON public.event_rsvps FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()));

CREATE UNIQUE INDEX idx_event_rsvps_event_user ON public.event_rsvps (event_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_event_rsvps_event_email ON public.event_rsvps (event_id, lower(guest_email)) WHERE guest_email IS NOT NULL;
CREATE INDEX idx_event_rsvps_event_status ON public.event_rsvps (event_id, status);
CREATE INDEX idx_event_rsvps_guest_email_created ON public.event_rsvps (lower(guest_email), created_at) WHERE guest_email IS NOT NULL;

-- ============ definer functions ============
CREATE OR REPLACE FUNCTION public.rsvp_to_event(_event_id uuid, _guest_name text DEFAULT NULL, _guest_email text DEFAULT NULL)
RETURNS public.event_rsvps
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev public.org_events%ROWTYPE;
  caller uuid := auth.uid();
  existing public.event_rsvps%ROWTYPE;
  going_count int;
  new_status text;
  email_norm text := lower(btrim(coalesce(_guest_email, '')));
  recent int;
  result public.event_rsvps%ROWTYPE;
BEGIN
  SELECT * INTO ev FROM public.org_events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF ev.status <> 'published' THEN RAISE EXCEPTION 'Event is not open for RSVP'; END IF;
  IF NOT ev.rsvp_enabled THEN RAISE EXCEPTION 'RSVP is disabled for this event'; END IF;

  IF caller IS NOT NULL THEN
    IF ev.visibility = 'members' AND NOT public.is_org_member(ev.organization_id, caller) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
    SELECT * INTO existing FROM public.event_rsvps
      WHERE event_id = _event_id AND user_id = caller FOR UPDATE;
  ELSE
    IF ev.visibility <> 'public' THEN RAISE EXCEPTION 'Not authorized'; END IF;
    IF btrim(coalesce(_guest_name, '')) = '' OR email_norm = '' THEN
      RAISE EXCEPTION 'Name and email are required';
    END IF;
    IF email_norm !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Invalid email'; END IF;

    -- Per-identity rate limit for the anon path (mirrors the app's sliding window):
    -- max 5 guest RSVPs per email address per hour.
    SELECT count(*) INTO recent FROM public.event_rsvps
      WHERE lower(guest_email) = email_norm AND created_at > now() - interval '1 hour';
    IF recent >= 5 THEN RAISE EXCEPTION 'Too many RSVP attempts. Please try again later.'; END IF;

    SELECT * INTO existing FROM public.event_rsvps
      WHERE event_id = _event_id AND lower(guest_email) = email_norm FOR UPDATE;
  END IF;

  IF existing.id IS NOT NULL AND existing.status IN ('going','waitlist') THEN
    RETURN existing;
  END IF;

  SELECT count(*) INTO going_count FROM public.event_rsvps
    WHERE event_id = _event_id AND status = 'going';

  IF ev.capacity IS NOT NULL AND going_count >= ev.capacity THEN
    new_status := 'waitlist';
  ELSE
    new_status := 'going';
  END IF;

  IF existing.id IS NOT NULL THEN
    UPDATE public.event_rsvps
      SET status = new_status, created_at = now(),
          guest_name = COALESCE(NULLIF(btrim(coalesce(_guest_name,'')), ''), guest_name)
      WHERE id = existing.id
      RETURNING * INTO result;
    RETURN result;
  END IF;

  INSERT INTO public.event_rsvps (event_id, organization_id, user_id, guest_name, guest_email, status)
  VALUES (
    _event_id,
    ev.organization_id,
    caller,
    CASE WHEN caller IS NULL THEN btrim(_guest_name) ELSE NULLIF(btrim(coalesce(_guest_name,'')), '') END,
    CASE WHEN caller IS NULL THEN email_norm ELSE NULL END,
    new_status
  )
  RETURNING * INTO result;

  RETURN result;
END $$;

REVOKE EXECUTE ON FUNCTION public.rsvp_to_event(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rsvp_to_event(uuid, text, text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.cancel_event_rsvp(_event_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  mine public.event_rsvps%ROWTYPE;
  ev public.org_events%ROWTYPE;
  next_id uuid;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO ev FROM public.org_events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;

  SELECT * INTO mine FROM public.event_rsvps
    WHERE event_id = _event_id AND user_id = caller FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No RSVP found'; END IF;
  IF mine.status = 'cancelled' THEN RETURN; END IF;

  UPDATE public.event_rsvps SET status = 'cancelled' WHERE id = mine.id;

  IF mine.status = 'going' THEN
    SELECT id INTO next_id FROM public.event_rsvps
      WHERE event_id = _event_id AND status = 'waitlist'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED;
    IF next_id IS NOT NULL THEN
      UPDATE public.event_rsvps SET status = 'going' WHERE id = next_id;
    END IF;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.cancel_event_rsvp(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.cancel_event_rsvp(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_events(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(x ORDER BY x_starts_at), '[]'::jsonb) INTO _result
  FROM (
    SELECT jsonb_build_object(
      'id', e.id, 'title', e.title, 'slug', e.slug, 'description', e.description,
      'location_name', e.location_name, 'location_address', e.location_address,
      'is_virtual', e.is_virtual, 'virtual_url', e.virtual_url,
      'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone,
      'cover_image_url', e.cover_image_url
    ) AS x, e.starts_at AS x_starts_at
    FROM public.org_events e
    WHERE e.organization_id = _org_id AND e.status = 'published' AND e.visibility = 'public'
  ) t;
  RETURN _result;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_public_events(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_events(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_event(_org_id uuid, _slug text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', e.id, 'title', e.title, 'slug', e.slug, 'description', e.description,
    'location_name', e.location_name, 'location_address', e.location_address,
    'is_virtual', e.is_virtual, 'virtual_url', e.virtual_url,
    'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone,
    'cover_image_url', e.cover_image_url
  ) INTO _result
  FROM public.org_events e
  WHERE e.organization_id = _org_id AND e.slug = _slug
    AND e.status = 'published' AND e.visibility = 'public'
  LIMIT 1;
  RETURN _result;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_public_event(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_event(uuid, text) TO anon, authenticated;