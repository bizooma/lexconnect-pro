INSERT INTO public.website_templates (
  is_global,
  name,
  description,
  page_type,
  default_sections_json,
  suggested_copy_json
)
VALUES (
  true,
  'Attorney Well-Being Resources',
  'Public well-being and lawyer-assistance resources page',
  'resource',
  '[
    {"section_type": "hero", "content_json": {"headline": "You Don''t Have to Carry It Alone", "subheadline": "Free, confidential well-being resources for our legal community", "cta_label": "Talk to Someone Today", "cta_href": "#resources"}},
    {"section_type": "resource_cards", "content_json": {"headline": "Confidential Help", "items": [{"title": "Florida Lawyers Helpline", "description": "Up to five free counseling sessions per year for lawyers, paralegals, and law students. Confidential and free. Call 833-351-9355.", "kind": "Free Counseling"}, {"title": "988 Suicide & Crisis Lifeline", "description": "Free, confidential crisis support, 24 hours a day. Call or text 988.", "kind": "Crisis Support"}, {"title": "Well-Being Week in Law", "description": "Programming and resources from the Institute for Well-Being in Law, every May.", "kind": "Programming", "href": "https://lawyerwellbeing.net"}]}},
    {"section_type": "faq", "content_json": {"items": [{"question": "Is it confidential?", "answer": "Yes. Lawyer assistance programs are confidential, and using them is not reported to the Bar."}, {"question": "Who can use these resources?", "answer": "Lawyers, judges, paralegals, and law students — regardless of bar membership."}, {"question": "What does it cost?", "answer": "The helpline and crisis line are free. Many programs include free counseling sessions."}]}},
    {"section_type": "cta", "content_json": {"headline": "Your well-being matters to this bar association", "cta_label": "Contact Us", "cta_href": "/contact"}}
  ]'::jsonb,
  '{}'::jsonb
);