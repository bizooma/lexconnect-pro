DO $$
DECLARE
  t RECORD;
  s jsonb;
  c jsonb;
  st text;
  arr jsonb;
  it jsonb;
  newarr jsonb;
  newsections jsonb;
BEGIN
  FOR t IN SELECT id, default_sections_json FROM public.website_templates WHERE is_global = true LOOP
    newsections := '[]'::jsonb;
    FOR s IN SELECT * FROM jsonb_array_elements(t.default_sections_json) LOOP
      c := coalesce(s->'content_json', '{}'::jsonb);
      st := s->>'section_type';

      -- common heading/cta key renames
      IF c ? 'heading' THEN c := (c - 'heading') || jsonb_build_object('headline', c->'heading'); END IF;
      IF c ? 'subheading' THEN c := (c - 'subheading') || jsonb_build_object('subheadline', c->'subheading'); END IF;
      IF c ? 'cta_url' THEN c := (c - 'cta_url') || jsonb_build_object('cta_href', c->'cta_url'); END IF;

      IF st = 'event_details' THEN
        IF c ? 'date' THEN c := (c - 'date') || jsonb_build_object('event_date', c->'date'); END IF;
        IF c ? 'schedule' THEN c := (c - 'schedule') || jsonb_build_object('body', c->'schedule'); END IF;
      END IF;

      -- list key renames -> items
      IF st = 'speaker_cards' AND c ? 'speakers' THEN c := (c - 'speakers') || jsonb_build_object('items', c->'speakers'); END IF;
      IF st = 'sponsor_grid' AND c ? 'sponsors' THEN c := (c - 'sponsors') || jsonb_build_object('items', c->'sponsors'); END IF;
      IF st = 'committee_cards' AND c ? 'members' THEN c := (c - 'members') || jsonb_build_object('items', c->'members'); END IF;
      IF st = 'resource_cards' AND c ? 'resources' THEN c := (c - 'resources') || jsonb_build_object('items', c->'resources'); END IF;
      IF st = 'pricing_tiers' AND c ? 'tiers' THEN c := (c - 'tiers') || jsonb_build_object('items', c->'tiers'); END IF;

      -- per-item field renames
      IF st IN ('speaker_cards','committee_cards','resource_cards','testimonials') AND jsonb_typeof(c->'items') = 'array' THEN
        arr := c->'items';
        newarr := '[]'::jsonb;
        FOR it IN SELECT * FROM jsonb_array_elements(arr) LOOP
          IF st = 'speaker_cards' THEN
            IF it ? 'title' THEN it := (it - 'title') || jsonb_build_object('role', it->'title'); END IF;
            IF it ? 'topic' THEN it := (it - 'topic') || jsonb_build_object('bio', it->'topic'); END IF;
          ELSIF st = 'committee_cards' THEN
            IF it ? 'firm' THEN it := (it - 'firm') || jsonb_build_object('bio', it->'firm'); END IF;
          ELSIF st = 'resource_cards' THEN
            IF it ? 'body' THEN it := (it - 'body') || jsonb_build_object('description', it->'body'); END IF;
            IF it ? 'cta' THEN it := (it - 'cta') || jsonb_build_object('kind', it->'cta'); END IF;
          ELSIF st = 'testimonials' THEN
            IF it ? 'name' THEN it := (it - 'name') || jsonb_build_object('author', it->'name'); END IF;
          END IF;
          newarr := newarr || jsonb_build_array(it);
        END LOOP;
        c := c || jsonb_build_object('items', newarr);
      END IF;

      newsections := newsections || jsonb_build_array(jsonb_set(s, '{content_json}', c));
    END LOOP;
    UPDATE public.website_templates SET default_sections_json = newsections, updated_at = now() WHERE id = t.id;
  END LOOP;
END $$;