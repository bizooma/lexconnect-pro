UPDATE public.website_templates
SET default_sections_json = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        default_sections_json,
        '{1,content_json,items,0,kind}',
        '"Free Legal Services"',
        true
      ),
      '{1,content_json,items,0,description}',
      to_jsonb(
        (default_sections_json #> '{1,content_json,items,0,description}')::text
        || ' Call (555) 010-4400.'
      ),
      true
    ),
    '{1,content_json,items,1,kind}',
    '"Walk-In Clinic"',
    true
  ),
  '{1,content_json,items,2,kind}',
  '"Reduced Fee"',
  true
)
WHERE is_global = true AND name = 'Legal Aid Resource Page';