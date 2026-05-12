
CREATE TYPE public.qa_post_status AS ENUM ('open','resolved','closed');
CREATE TYPE public.qa_target_type AS ENUM ('post','reply');
CREATE TYPE public.qa_notif_mode AS ENUM ('all','my_posts','followed','digest','muted');

CREATE TABLE public.qa_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);
CREATE INDEX qa_categories_org_idx ON public.qa_categories(organization_id) WHERE archived = false;

CREATE TABLE public.qa_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  author_id uuid NOT NULL,
  category_id uuid REFERENCES public.qa_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  status public.qa_post_status NOT NULL DEFAULT 'open',
  is_urgent boolean NOT NULL DEFAULT false,
  is_anonymous boolean NOT NULL DEFAULT false,
  allow_private_replies boolean NOT NULL DEFAULT false,
  is_pinned boolean NOT NULL DEFAULT false,
  reply_count int NOT NULL DEFAULT 0,
  best_answer_id uuid,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_tsv tsvector
);
CREATE INDEX qa_posts_org_activity_idx ON public.qa_posts(organization_id, last_activity_at DESC);
CREATE INDEX qa_posts_org_category_idx ON public.qa_posts(organization_id, category_id);
CREATE INDEX qa_posts_tags_idx ON public.qa_posts USING GIN(tags);
CREATE INDEX qa_posts_search_idx ON public.qa_posts USING GIN(search_tsv);

CREATE TABLE public.qa_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.qa_posts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  author_id uuid NOT NULL,
  parent_reply_id uuid REFERENCES public.qa_replies(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_private boolean NOT NULL DEFAULT false,
  helpful_count int NOT NULL DEFAULT 0,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  search_tsv tsvector
);
CREATE INDEX qa_replies_post_idx ON public.qa_replies(post_id, created_at);
CREATE INDEX qa_replies_org_idx ON public.qa_replies(organization_id);
CREATE INDEX qa_replies_search_idx ON public.qa_replies USING GIN(search_tsv);

ALTER TABLE public.qa_posts
  ADD CONSTRAINT qa_posts_best_answer_fk
  FOREIGN KEY (best_answer_id) REFERENCES public.qa_replies(id) ON DELETE SET NULL;

CREATE TABLE public.qa_post_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.qa_posts(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, resource_id)
);
CREATE INDEX qa_post_att_post_idx ON public.qa_post_attachments(post_id);

CREATE TABLE public.qa_reply_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_id uuid NOT NULL REFERENCES public.qa_replies(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(reply_id, resource_id)
);
CREATE INDEX qa_reply_att_reply_idx ON public.qa_reply_attachments(reply_id);

CREATE TABLE public.qa_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  target_type public.qa_target_type NOT NULL,
  target_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'helpful',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_type, target_id, kind)
);
CREATE INDEX qa_reactions_target_idx ON public.qa_reactions(target_type, target_id);

CREATE TABLE public.qa_follows (
  user_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES public.qa_posts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX qa_follows_post_idx ON public.qa_follows(post_id);

CREATE TABLE public.qa_bookmarks (
  user_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES public.qa_posts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE public.qa_notification_prefs (
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  mode public.qa_notif_mode NOT NULL DEFAULT 'all',
  category_ids uuid[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, organization_id)
);

ALTER TABLE public.qa_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_post_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_reply_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_categories_select" ON public.qa_categories FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "qa_categories_admin_all" ON public.qa_categories FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "qa_posts_select" ON public.qa_posts FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "qa_posts_insert" ON public.qa_posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND public.is_org_member(organization_id, auth.uid()) AND public.org_can_write(organization_id));
CREATE POLICY "qa_posts_update" ON public.qa_posts FOR UPDATE TO authenticated
  USING (auth.uid() = author_id OR public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "qa_posts_delete" ON public.qa_posts FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "qa_replies_select" ON public.qa_replies FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (
      is_private = false
      OR auth.uid() = author_id
      OR EXISTS (SELECT 1 FROM public.qa_posts p WHERE p.id = qa_replies.post_id AND p.author_id = auth.uid())
      OR public.is_org_admin(organization_id, auth.uid())
    )
  );
CREATE POLICY "qa_replies_insert" ON public.qa_replies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND public.is_org_member(organization_id, auth.uid()) AND public.org_can_write(organization_id));
CREATE POLICY "qa_replies_update" ON public.qa_replies FOR UPDATE TO authenticated
  USING (auth.uid() = author_id OR public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "qa_replies_delete" ON public.qa_replies FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "qa_post_att_select" ON public.qa_post_attachments FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "qa_post_att_insert" ON public.qa_post_attachments FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid())
    AND EXISTS (SELECT 1 FROM public.qa_posts p WHERE p.id = post_id AND p.author_id = auth.uid()));
CREATE POLICY "qa_post_att_delete" ON public.qa_post_attachments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.qa_posts p WHERE p.id = post_id AND (p.author_id = auth.uid() OR public.is_org_admin(p.organization_id, auth.uid()))));

CREATE POLICY "qa_reply_att_select" ON public.qa_reply_attachments FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "qa_reply_att_insert" ON public.qa_reply_attachments FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid())
    AND EXISTS (SELECT 1 FROM public.qa_replies r WHERE r.id = reply_id AND r.author_id = auth.uid()));
CREATE POLICY "qa_reply_att_delete" ON public.qa_reply_attachments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.qa_replies r WHERE r.id = reply_id AND (r.author_id = auth.uid() OR public.is_org_admin(r.organization_id, auth.uid()))));

CREATE POLICY "qa_reactions_select" ON public.qa_reactions FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "qa_reactions_insert" ON public.qa_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "qa_reactions_delete" ON public.qa_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "qa_follows_all" ON public.qa_follows FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "qa_bookmarks_all" ON public.qa_bookmarks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "qa_prefs_all" ON public.qa_notification_prefs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND public.is_org_member(organization_id, auth.uid()));

-- Search vector triggers (use immutable approach)
CREATE OR REPLACE FUNCTION public.qa_posts_tsv_update()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('english', coalesce(NEW.title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.body,'')),  'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags,' '),'')), 'C');
  RETURN NEW;
END $$;
CREATE TRIGGER qa_posts_tsv_trg BEFORE INSERT OR UPDATE OF title, body, tags ON public.qa_posts
FOR EACH ROW EXECUTE FUNCTION public.qa_posts_tsv_update();

CREATE OR REPLACE FUNCTION public.qa_replies_tsv_update()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.search_tsv := to_tsvector('english', coalesce(NEW.body,''));
  RETURN NEW;
END $$;
CREATE TRIGGER qa_replies_tsv_trg BEFORE INSERT OR UPDATE OF body ON public.qa_replies
FOR EACH ROW EXECUTE FUNCTION public.qa_replies_tsv_update();

-- Reply count + activity
CREATE OR REPLACE FUNCTION public.qa_touch_post_on_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.qa_posts
       SET reply_count = reply_count + 1,
           last_activity_at = NEW.created_at,
           updated_at = now()
     WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.qa_posts
       SET reply_count = GREATEST(reply_count - 1, 0),
           updated_at = now()
     WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER qa_replies_count_trg
AFTER INSERT OR DELETE ON public.qa_replies
FOR EACH ROW EXECUTE FUNCTION public.qa_touch_post_on_reply();

CREATE OR REPLACE FUNCTION public.qa_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER qa_posts_updated_trg BEFORE UPDATE ON public.qa_posts
FOR EACH ROW EXECUTE FUNCTION public.qa_set_updated_at();

CREATE OR REPLACE FUNCTION public.qa_notify_on_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  post_record record;
  author_name text;
  recipient uuid;
  pref_mode public.qa_notif_mode;
BEGIN
  SELECT id, organization_id, author_id, title INTO post_record
    FROM public.qa_posts WHERE id = NEW.post_id;
  IF post_record.id IS NULL THEN RETURN NEW; END IF;

  SELECT full_name INTO author_name FROM public.profiles WHERE user_id = NEW.author_id;

  IF post_record.author_id <> NEW.author_id THEN
    SELECT mode INTO pref_mode FROM public.qa_notification_prefs
      WHERE user_id = post_record.author_id AND organization_id = post_record.organization_id;
    IF pref_mode IS NULL OR pref_mode IN ('all','my_posts','followed') THEN
      INSERT INTO public.notifications (user_id, organization_id, kind, title, body, link, related_id)
      VALUES (post_record.author_id, post_record.organization_id, 'qa_reply',
        'New reply to your question',
        COALESCE(author_name,'A member') || ' replied to "' || LEFT(post_record.title, 60) || '"',
        '/app/qa/' || post_record.id::text, NEW.id);
    END IF;
  END IF;

  FOR recipient IN
    SELECT f.user_id FROM public.qa_follows f
    WHERE f.post_id = post_record.id
      AND f.user_id <> NEW.author_id
      AND f.user_id <> post_record.author_id
  LOOP
    SELECT mode INTO pref_mode FROM public.qa_notification_prefs
      WHERE user_id = recipient AND organization_id = post_record.organization_id;
    IF pref_mode IS NULL OR pref_mode IN ('all','followed') THEN
      INSERT INTO public.notifications (user_id, organization_id, kind, title, body, link, related_id)
      VALUES (recipient, post_record.organization_id, 'qa_followed_reply',
        'New reply in followed discussion',
        COALESCE(author_name,'A member') || ' replied to "' || LEFT(post_record.title, 60) || '"',
        '/app/qa/' || post_record.id::text, NEW.id);
    END IF;
  END LOOP;

  RETURN NEW;
END $$;
CREATE TRIGGER qa_replies_notify_trg
AFTER INSERT ON public.qa_replies
FOR EACH ROW EXECUTE FUNCTION public.qa_notify_on_reply();

CREATE OR REPLACE FUNCTION public.qa_notify_best_answer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  reply_author uuid;
BEGIN
  IF NEW.best_answer_id IS NOT NULL
     AND (OLD.best_answer_id IS DISTINCT FROM NEW.best_answer_id) THEN
    SELECT author_id INTO reply_author FROM public.qa_replies WHERE id = NEW.best_answer_id;
    IF reply_author IS NOT NULL AND reply_author <> NEW.author_id THEN
      INSERT INTO public.notifications (user_id, organization_id, kind, title, body, link, related_id)
      VALUES (reply_author, NEW.organization_id, 'qa_best_answer',
        'Marked as Best Answer',
        'Your reply was marked as the best answer on "' || LEFT(NEW.title, 60) || '"',
        '/app/qa/' || NEW.id::text, NEW.best_answer_id);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER qa_posts_best_answer_trg
AFTER UPDATE OF best_answer_id ON public.qa_posts
FOR EACH ROW EXECUTE FUNCTION public.qa_notify_best_answer();

CREATE OR REPLACE FUNCTION public.qa_reaction_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.target_type = 'reply' AND NEW.kind = 'helpful' THEN
    UPDATE public.qa_replies SET helpful_count = helpful_count + 1 WHERE id = NEW.target_id;
  ELSIF TG_OP = 'DELETE' AND OLD.target_type = 'reply' AND OLD.kind = 'helpful' THEN
    UPDATE public.qa_replies SET helpful_count = GREATEST(helpful_count - 1, 0) WHERE id = OLD.target_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER qa_reactions_count_trg
AFTER INSERT OR DELETE ON public.qa_reactions
FOR EACH ROW EXECUTE FUNCTION public.qa_reaction_count();

INSERT INTO public.qa_categories (organization_id, name, slug, sort_order)
SELECT o.id, c.name, c.slug, c.sort_order
FROM public.organizations o
CROSS JOIN (VALUES
  ('Estate Planning','estate-planning',10),
  ('Probate','probate',20),
  ('Business Litigation','business-litigation',30),
  ('Family Law','family-law',40),
  ('Real Estate','real-estate',50),
  ('Ethics','ethics',60),
  ('Technology','technology',70),
  ('General Practice','general-practice',80),
  ('Referrals','referrals',90),
  ('Court Procedures','court-procedures',100),
  ('Forms & Templates','forms-templates',110)
) AS c(name, slug, sort_order)
ON CONFLICT (organization_id, slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.qa_seed_categories_for_new_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.qa_categories (organization_id, name, slug, sort_order)
  VALUES
    (NEW.id,'Estate Planning','estate-planning',10),
    (NEW.id,'Probate','probate',20),
    (NEW.id,'Business Litigation','business-litigation',30),
    (NEW.id,'Family Law','family-law',40),
    (NEW.id,'Real Estate','real-estate',50),
    (NEW.id,'Ethics','ethics',60),
    (NEW.id,'Technology','technology',70),
    (NEW.id,'General Practice','general-practice',80),
    (NEW.id,'Referrals','referrals',90),
    (NEW.id,'Court Procedures','court-procedures',100),
    (NEW.id,'Forms & Templates','forms-templates',110)
  ON CONFLICT (organization_id, slug) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER qa_seed_categories_trg
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.qa_seed_categories_for_new_org();

ALTER PUBLICATION supabase_realtime ADD TABLE public.qa_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.qa_replies;
