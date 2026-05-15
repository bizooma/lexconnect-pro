
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.website_page_status AS ENUM ('draft','ready_for_review','scheduled','published','archived');
CREATE TYPE public.website_page_type AS ENUM ('home','landing','event','sponsor','committee','mentorship','cle','resource','blog','legal_aid','custom');
CREATE TYPE public.website_section_type AS ENUM (
  'hero','text','image_text','cta','event_details','sponsor_grid','speaker_cards',
  'member_directory','committee_cards','resource_cards','faq','testimonials',
  'contact_form','newsletter','video','pricing_tiers','feature_grid','stats',
  'timeline','custom_html'
);
CREATE TYPE public.website_ai_generation_kind AS ENUM ('page_draft','section_rewrite','copy_rewrite','seo','accessibility','faq','cta');
CREATE TYPE public.website_publish_action AS ENUM ('publish','unpublish','schedule','archive');

-- ============================================================
-- TABLES
-- ============================================================
CREATE TABLE public.website_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  title text NOT NULL,
  slug text NOT NULL,
  page_type public.website_page_type NOT NULL DEFAULT 'custom',
  status public.website_page_status NOT NULL DEFAULT 'draft',
  meta_title text,
  meta_description text,
  og_title text,
  og_description text,
  og_image text,
  content_json jsonb NOT NULL DEFAULT '{"sections":[]}'::jsonb,
  content_html text,
  created_by uuid,
  updated_by uuid,
  published_at timestamptz,
  scheduled_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);
CREATE INDEX website_pages_org_status_idx ON public.website_pages (organization_id, status, updated_at DESC);
CREATE INDEX website_pages_org_type_idx   ON public.website_pages (organization_id, page_type);

CREATE TABLE public.website_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.website_pages(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  section_type public.website_section_type NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  settings_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  visible boolean NOT NULL DEFAULT true,
  responsive_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX website_sections_page_idx ON public.website_sections (page_id, display_order);

CREATE TABLE public.website_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  is_global boolean NOT NULL DEFAULT false,
  name text NOT NULL,
  description text,
  page_type public.website_page_type NOT NULL DEFAULT 'custom',
  preview_image text,
  default_sections_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggested_copy_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((is_global = true AND organization_id IS NULL) OR (is_global = false AND organization_id IS NOT NULL))
);
CREATE INDEX website_templates_org_idx ON public.website_templates (organization_id);
CREATE INDEX website_templates_global_idx ON public.website_templates (is_global) WHERE is_global = true;

CREATE TABLE public.website_brand_settings (
  organization_id uuid PRIMARY KEY,
  logo_url text,
  favicon_url text,
  primary_color text DEFAULT '#0F1B3D',
  secondary_color text DEFAULT '#3B6FA0',
  accent_color text DEFAULT '#C9A84C',
  heading_font text DEFAULT 'Playfair Display',
  body_font text DEFAULT 'Inter',
  button_style text DEFAULT 'rounded',
  page_width text DEFAULT '1200px',
  border_radius text DEFAULT '0.75rem',
  seo_title_suffix text,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  footer_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.website_saved_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  section_type public.website_section_type NOT NULL,
  settings_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX website_saved_sections_org_idx ON public.website_saved_sections (organization_id, updated_at DESC);

CREATE TABLE public.website_ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  prompt text NOT NULL,
  kind public.website_ai_generation_kind NOT NULL,
  generated_content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  tokens_used integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX website_ai_org_idx ON public.website_ai_generations (organization_id, created_at DESC);

CREATE TABLE public.website_publish_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.website_pages(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  published_by uuid,
  action public.website_publish_action NOT NULL,
  version_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX website_publish_hist_page_idx ON public.website_publish_history (page_id, published_at DESC);
CREATE INDEX website_publish_hist_org_idx  ON public.website_publish_history (organization_id, published_at DESC);

-- ============================================================
-- updated_at TRIGGERS (reuse existing function)
-- ============================================================
CREATE TRIGGER trg_website_pages_updated   BEFORE UPDATE ON public.website_pages   FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_website_sections_upd    BEFORE UPDATE ON public.website_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_website_templates_upd   BEFORE UPDATE ON public.website_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_website_brand_upd       BEFORE UPDATE ON public.website_brand_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_website_saved_upd       BEFORE UPDATE ON public.website_saved_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Snapshot publish history when status transitions to published/scheduled/archived
CREATE OR REPLACE FUNCTION public.website_pages_publish_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE act public.website_publish_action;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'published' THEN act := 'publish';
    ELSIF NEW.status = 'scheduled' THEN act := 'schedule';
    ELSIF NEW.status = 'archived' THEN act := 'archive';
    ELSIF OLD.status = 'published' AND NEW.status <> 'published' THEN act := 'unpublish';
    ELSE RETURN NEW;
    END IF;
    INSERT INTO public.website_publish_history (page_id, organization_id, published_by, action, version_snapshot_json)
    VALUES (NEW.id, NEW.organization_id, NEW.updated_by, act,
      jsonb_build_object(
        'title', NEW.title, 'slug', NEW.slug, 'page_type', NEW.page_type,
        'status', NEW.status, 'meta_title', NEW.meta_title,
        'meta_description', NEW.meta_description, 'content_json', NEW.content_json
      ));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_website_pages_publish_snapshot
  AFTER UPDATE ON public.website_pages FOR EACH ROW EXECUTE FUNCTION public.website_pages_publish_snapshot();

-- Auto-create brand settings row for new orgs
CREATE OR REPLACE FUNCTION public.website_seed_brand_for_new_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.website_brand_settings (organization_id) VALUES (NEW.id)
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_website_seed_brand_for_new_org
  AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.website_seed_brand_for_new_org();

-- Backfill brand settings for existing orgs
INSERT INTO public.website_brand_settings (organization_id)
SELECT id FROM public.organizations
ON CONFLICT (organization_id) DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.website_pages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_sections        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_brand_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_saved_sections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_ai_generations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_publish_history ENABLE ROW LEVEL SECURITY;

-- pages
CREATE POLICY website_pages_select ON public.website_pages FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY website_pages_insert ON public.website_pages FOR INSERT TO authenticated
  WITH CHECK ((is_org_admin(organization_id, auth.uid()) OR has_role(auth.uid(),'admin')) AND org_can_write(organization_id));
CREATE POLICY website_pages_update ON public.website_pages FOR UPDATE TO authenticated
  USING (is_org_admin(organization_id, auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY website_pages_delete ON public.website_pages FOR DELETE TO authenticated
  USING (is_org_admin(organization_id, auth.uid()) OR has_role(auth.uid(),'admin'));

-- sections
CREATE POLICY website_sections_select ON public.website_sections FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY website_sections_write ON public.website_sections FOR ALL TO authenticated
  USING (is_org_admin(organization_id, auth.uid()) OR has_role(auth.uid(),'admin'))
  WITH CHECK ((is_org_admin(organization_id, auth.uid()) OR has_role(auth.uid(),'admin')) AND org_can_write(organization_id));

-- templates: globals readable to all authenticated; org templates to members; admins write
CREATE POLICY website_templates_select ON public.website_templates FOR SELECT TO authenticated
  USING (is_global = true OR (organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid())) OR has_role(auth.uid(),'admin'));
CREATE POLICY website_templates_write ON public.website_templates FOR ALL TO authenticated
  USING (
    has_role(auth.uid(),'admin')
    OR (is_global = false AND organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
  )
  WITH CHECK (
    has_role(auth.uid(),'admin')
    OR (is_global = false AND organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()) AND org_can_write(organization_id))
  );

-- brand settings
CREATE POLICY website_brand_select ON public.website_brand_settings FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY website_brand_write ON public.website_brand_settings FOR ALL TO authenticated
  USING (is_org_admin(organization_id, auth.uid()) OR has_role(auth.uid(),'admin'))
  WITH CHECK ((is_org_admin(organization_id, auth.uid()) OR has_role(auth.uid(),'admin')) AND org_can_write(organization_id));

-- saved sections
CREATE POLICY website_saved_select ON public.website_saved_sections FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY website_saved_write ON public.website_saved_sections FOR ALL TO authenticated
  USING (is_org_admin(organization_id, auth.uid()) OR has_role(auth.uid(),'admin'))
  WITH CHECK ((is_org_admin(organization_id, auth.uid()) OR has_role(auth.uid(),'admin')) AND org_can_write(organization_id));

-- AI generations
CREATE POLICY website_ai_select ON public.website_ai_generations FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY website_ai_insert ON public.website_ai_generations FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) AND (is_org_admin(organization_id, auth.uid()) OR has_role(auth.uid(),'admin')));

-- publish history
CREATE POLICY website_publish_hist_select ON public.website_publish_history FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()) OR has_role(auth.uid(),'admin'));

-- ============================================================
-- SEED GLOBAL TEMPLATES
-- ============================================================
INSERT INTO public.website_templates (is_global, name, description, page_type, default_sections_json) VALUES
  (true,'Bar Association Homepage','Welcoming homepage for state or local bar associations','home',
    '[{"section_type":"hero","content_json":{"heading":"Welcome to Our Bar Association","subheading":"Serving the legal community since 1900","cta_label":"Become a Member","cta_url":"/join"}},{"section_type":"feature_grid","content_json":{"heading":"Member Benefits","items":[{"title":"CLE Programs","body":"Continuing legal education courses"},{"title":"Networking","body":"Connect with fellow attorneys"},{"title":"Mentorship","body":"Guidance from experienced attorneys"}]}},{"section_type":"cta","content_json":{"heading":"Join today","cta_label":"Get Started","cta_url":"/join"}}]'::jsonb),
  (true,'Annual Convention Landing Page','Promote your annual convention or major event','event',
    '[{"section_type":"hero","content_json":{"heading":"Annual Convention 2026","subheading":"Three days of CLE, networking, and inspiration","cta_label":"Register Now","cta_url":"#register"}},{"section_type":"event_details","content_json":{"date":"TBD","location":"TBD","schedule":"TBD"}},{"section_type":"speaker_cards","content_json":{"heading":"Featured Speakers","speakers":[]}},{"section_type":"sponsor_grid","content_json":{"heading":"Our Sponsors","sponsors":[]}},{"section_type":"faq","content_json":{"items":[]}}]'::jsonb),
  (true,'CLE Event Page','Continuing legal education event page','cle',
    '[{"section_type":"hero","content_json":{"heading":"CLE Program","subheading":"Earn credits with our latest course"}},{"section_type":"event_details","content_json":{"date":"TBD","location":"Online","credits":"1.0"}},{"section_type":"text","content_json":{"heading":"What you''ll learn","body":"Course description goes here."}},{"section_type":"cta","content_json":{"heading":"Reserve your seat","cta_label":"Register","cta_url":"#"}}]'::jsonb),
  (true,'Sponsorship Opportunities','Pitch sponsors on partnership tiers','sponsor',
    '[{"section_type":"hero","content_json":{"heading":"Partner With Us","subheading":"Connect your brand with the legal community"}},{"section_type":"pricing_tiers","content_json":{"heading":"Sponsorship Tiers","tiers":[{"name":"Platinum","price":"$10,000","features":["Top logo placement","10 event passes"]},{"name":"Gold","price":"$5,000","features":["Logo placement","5 event passes"]},{"name":"Silver","price":"$2,500","features":["Listing","2 event passes"]}]}},{"section_type":"contact_form","content_json":{"heading":"Talk to us"}}]'::jsonb),
  (true,'Mentorship Program','Recruit mentors and mentees','mentorship',
    '[{"section_type":"hero","content_json":{"heading":"Mentorship Program","subheading":"Pairing experienced attorneys with new lawyers"}},{"section_type":"feature_grid","content_json":{"items":[{"title":"For Mentors","body":"Share your expertise"},{"title":"For Mentees","body":"Learn from the best"},{"title":"Structured","body":"Curated 1:1 matches"}]}},{"section_type":"cta","content_json":{"heading":"Ready to get matched?","cta_label":"Apply Now","cta_url":"#"}}]'::jsonb),
  (true,'Committee Page','Standing committee landing page','committee',
    '[{"section_type":"hero","content_json":{"heading":"Committee Name","subheading":"Mission statement"}},{"section_type":"text","content_json":{"heading":"About this committee","body":"Description"}},{"section_type":"committee_cards","content_json":{"members":[]}},{"section_type":"cta","content_json":{"heading":"Join this committee","cta_label":"Express Interest","cta_url":"#"}}]'::jsonb),
  (true,'Member Benefits','Comprehensive benefits overview','landing',
    '[{"section_type":"hero","content_json":{"heading":"Why Become a Member","subheading":"Benefits that grow your practice"}},{"section_type":"feature_grid","content_json":{"items":[]}},{"section_type":"testimonials","content_json":{"items":[]}},{"section_type":"cta","content_json":{"heading":"Join now","cta_label":"Become a Member","cta_url":"/join"}}]'::jsonb),
  (true,'Join / Renew Membership','Streamlined membership signup','landing',
    '[{"section_type":"hero","content_json":{"heading":"Join Our Bar Association","subheading":"Membership starts here"}},{"section_type":"pricing_tiers","content_json":{"tiers":[{"name":"Standard","price":"$200/yr"},{"name":"Young Lawyer","price":"$100/yr"},{"name":"Student","price":"Free"}]}},{"section_type":"contact_form","content_json":{"heading":"Apply"}}]'::jsonb),
  (true,'Legal Aid Resource Page','Public-facing legal aid resources','legal_aid',
    '[{"section_type":"hero","content_json":{"heading":"Free Legal Help","subheading":"Find pro bono and legal aid resources"}},{"section_type":"resource_cards","content_json":{"resources":[]}},{"section_type":"faq","content_json":{"items":[]}},{"section_type":"cta","content_json":{"heading":"Need help now?","cta_label":"Contact Intake","cta_url":"#"}}]'::jsonb),
  (true,'Judicial Reception','Honor the bench','event',
    '[{"section_type":"hero","content_json":{"heading":"Judicial Reception","subheading":"An evening honoring our judiciary"}},{"section_type":"event_details","content_json":{"date":"TBD","location":"TBD"}},{"section_type":"cta","content_json":{"heading":"RSVP","cta_label":"Reserve","cta_url":"#"}}]'::jsonb),
  (true,'Newsletter Article','Long-form member news article','blog',
    '[{"section_type":"hero","content_json":{"heading":"Article Title","subheading":"By Author Name"}},{"section_type":"text","content_json":{"body":"Article body goes here."}},{"section_type":"newsletter","content_json":{"heading":"Subscribe to our newsletter"}}]'::jsonb),
  (true,'Sponsor Spotlight','Feature a partner','sponsor',
    '[{"section_type":"hero","content_json":{"heading":"Sponsor Spotlight","subheading":"Meet our partner"}},{"section_type":"image_text","content_json":{"heading":"About them","body":"Description"}},{"section_type":"cta","content_json":{"heading":"Visit their site","cta_label":"Learn More","cta_url":"#"}}]'::jsonb),
  (true,'Volunteer Signup','Recruit volunteers','landing',
    '[{"section_type":"hero","content_json":{"heading":"Volunteer With Us","subheading":"Make a difference in our legal community"}},{"section_type":"feature_grid","content_json":{"items":[]}},{"section_type":"contact_form","content_json":{"heading":"Sign up to volunteer"}}]'::jsonb);
