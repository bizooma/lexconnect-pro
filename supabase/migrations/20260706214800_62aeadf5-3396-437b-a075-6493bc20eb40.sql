
-- ============ ENUMS ============
CREATE TYPE public.ce_course_status AS ENUM ('draft','published','archived');
CREATE TYPE public.ce_question_kind AS ENUM ('multiple_choice','true_false');
CREATE TYPE public.ce_enrollment_status AS ENUM ('in_progress','completed');

-- ============ TABLES ============
CREATE TABLE public.ce_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  description text,
  cover_image_url text,
  credit_hours numeric(5,2) NOT NULL DEFAULT 0,
  status public.ce_course_status NOT NULL DEFAULT 'draft',
  allow_self_enroll boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ce_courses TO authenticated;
GRANT ALL ON public.ce_courses TO service_role;
ALTER TABLE public.ce_courses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ce_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.ce_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  display_order int NOT NULL DEFAULT 0,
  youtube_url text NOT NULL,
  youtube_video_id text NOT NULL,
  duration_seconds int,
  required boolean NOT NULL DEFAULT true,
  has_quiz boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ce_lessons_course_idx ON public.ce_lessons(course_id, display_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ce_lessons TO authenticated;
GRANT ALL ON public.ce_lessons TO service_role;
ALTER TABLE public.ce_lessons ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ce_quiz_settings (
  lesson_id uuid PRIMARY KEY REFERENCES public.ce_lessons(id) ON DELETE CASCADE,
  passing_score_pct int NOT NULL DEFAULT 80,
  max_attempts int,
  shuffle_questions boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ce_quiz_settings TO authenticated;
GRANT ALL ON public.ce_quiz_settings TO service_role;
ALTER TABLE public.ce_quiz_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ce_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.ce_lessons(id) ON DELETE CASCADE,
  display_order int NOT NULL DEFAULT 0,
  prompt text NOT NULL,
  kind public.ce_question_kind NOT NULL DEFAULT 'multiple_choice',
  multi_select boolean NOT NULL DEFAULT false,
  explanation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ce_questions_lesson_idx ON public.ce_quiz_questions(lesson_id, display_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ce_quiz_questions TO authenticated;
GRANT ALL ON public.ce_quiz_questions TO service_role;
ALTER TABLE public.ce_quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ce_quiz_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.ce_quiz_questions(id) ON DELETE CASCADE,
  display_order int NOT NULL DEFAULT 0,
  label text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false
);
CREATE INDEX ce_options_question_idx ON public.ce_quiz_options(question_id, display_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ce_quiz_options TO authenticated;
GRANT ALL ON public.ce_quiz_options TO service_role;
ALTER TABLE public.ce_quiz_options ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ce_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.ce_courses(id) ON DELETE CASCADE,
  assignee_user_id uuid,
  assignee_role public.org_role,
  due_at timestamptz,
  required boolean NOT NULL DEFAULT true,
  assigned_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((assignee_user_id IS NOT NULL) <> (assignee_role IS NOT NULL))
);
CREATE INDEX ce_assignments_course_idx ON public.ce_assignments(course_id);
CREATE INDEX ce_assignments_user_idx ON public.ce_assignments(assignee_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ce_assignments TO authenticated;
GRANT ALL ON public.ce_assignments TO service_role;
ALTER TABLE public.ce_assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ce_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.ce_courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status public.ce_enrollment_status NOT NULL DEFAULT 'in_progress',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (course_id, user_id)
);
CREATE INDEX ce_enrollments_user_idx ON public.ce_enrollments(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ce_enrollments TO authenticated;
GRANT ALL ON public.ce_enrollments TO service_role;
ALTER TABLE public.ce_enrollments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ce_lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.ce_enrollments(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.ce_lessons(id) ON DELETE CASCADE,
  video_watched_at timestamptz,
  passed_at timestamptz,
  best_score_pct int,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, lesson_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ce_lesson_progress TO authenticated;
GRANT ALL ON public.ce_lesson_progress TO service_role;
ALTER TABLE public.ce_lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ce_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.ce_lessons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  enrollment_id uuid NOT NULL REFERENCES public.ce_enrollments(id) ON DELETE CASCADE,
  attempt_no int NOT NULL,
  score_pct int NOT NULL,
  passed boolean NOT NULL,
  answers_json jsonb NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ce_attempts_user_idx ON public.ce_quiz_attempts(user_id);
CREATE INDEX ce_attempts_lesson_idx ON public.ce_quiz_attempts(lesson_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ce_quiz_attempts TO authenticated;
GRANT ALL ON public.ce_quiz_attempts TO service_role;
ALTER TABLE public.ce_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- ============ HELPER: is user assigned to this course ============
CREATE OR REPLACE FUNCTION public.ce_user_can_access_course(_course_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ce_courses c
    WHERE c.id = _course_id
      AND c.status = 'published'
      AND (
        c.allow_self_enroll
        OR EXISTS (
          SELECT 1 FROM public.ce_assignments a
          WHERE a.course_id = c.id
            AND (
              a.assignee_user_id = _user_id
              OR (a.assignee_role IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.organization_members m
                WHERE m.organization_id = c.organization_id
                  AND m.user_id = _user_id
                  AND m.status = 'active'
                  AND m.org_role = a.assignee_role
              ))
            )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.ce_org_of_course(_course_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT organization_id FROM public.ce_courses WHERE id = _course_id $$;

CREATE OR REPLACE FUNCTION public.ce_org_of_lesson(_lesson_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.organization_id FROM public.ce_lessons l
  JOIN public.ce_courses c ON c.id = l.course_id
  WHERE l.id = _lesson_id
$$;

-- ============ RLS POLICIES ============
-- ce_courses
CREATE POLICY "org admins manage courses" ON public.ce_courses
  FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));
CREATE POLICY "members read accessible courses" ON public.ce_courses
  FOR SELECT TO authenticated
  USING (
    public.is_org_admin(organization_id, auth.uid())
    OR (status = 'published' AND public.is_org_member(organization_id, auth.uid()))
  );

-- ce_lessons
CREATE POLICY "org admins manage lessons" ON public.ce_lessons
  FOR ALL TO authenticated
  USING (public.is_org_admin(public.ce_org_of_course(course_id), auth.uid()))
  WITH CHECK (public.is_org_admin(public.ce_org_of_course(course_id), auth.uid()));
CREATE POLICY "members read lessons of accessible courses" ON public.ce_lessons
  FOR SELECT TO authenticated
  USING (public.ce_user_can_access_course(course_id, auth.uid()));

-- ce_quiz_settings
CREATE POLICY "admins manage quiz settings" ON public.ce_quiz_settings
  FOR ALL TO authenticated
  USING (public.is_org_admin(public.ce_org_of_lesson(lesson_id), auth.uid()))
  WITH CHECK (public.is_org_admin(public.ce_org_of_lesson(lesson_id), auth.uid()));
CREATE POLICY "members read quiz settings" ON public.ce_quiz_settings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ce_lessons l WHERE l.id = lesson_id
      AND public.ce_user_can_access_course(l.course_id, auth.uid())
  ));

-- ce_quiz_questions
CREATE POLICY "admins manage questions" ON public.ce_quiz_questions
  FOR ALL TO authenticated
  USING (public.is_org_admin(public.ce_org_of_lesson(lesson_id), auth.uid()))
  WITH CHECK (public.is_org_admin(public.ce_org_of_lesson(lesson_id), auth.uid()));
-- NOTE: members do NOT read questions/options directly; server fn strips is_correct.

-- ce_quiz_options
CREATE POLICY "admins manage options" ON public.ce_quiz_options
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ce_quiz_questions q
    WHERE q.id = question_id
      AND public.is_org_admin(public.ce_org_of_lesson(q.lesson_id), auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ce_quiz_questions q
    WHERE q.id = question_id
      AND public.is_org_admin(public.ce_org_of_lesson(q.lesson_id), auth.uid())
  ));

-- ce_assignments
CREATE POLICY "admins manage assignments" ON public.ce_assignments
  FOR ALL TO authenticated
  USING (public.is_org_admin(public.ce_org_of_course(course_id), auth.uid()))
  WITH CHECK (public.is_org_admin(public.ce_org_of_course(course_id), auth.uid()));
CREATE POLICY "user sees own assignments" ON public.ce_assignments
  FOR SELECT TO authenticated
  USING (assignee_user_id = auth.uid());

-- ce_enrollments
CREATE POLICY "user manages own enrollment" ON public.ce_enrollments
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins view org enrollments" ON public.ce_enrollments
  FOR SELECT TO authenticated
  USING (public.is_org_admin(public.ce_org_of_course(course_id), auth.uid()));

-- ce_lesson_progress
CREATE POLICY "user manages own progress" ON public.ce_lesson_progress
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ce_enrollments e
    WHERE e.id = enrollment_id AND e.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ce_enrollments e
    WHERE e.id = enrollment_id AND e.user_id = auth.uid()
  ));
CREATE POLICY "admins view org progress" ON public.ce_lesson_progress
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ce_enrollments e
    WHERE e.id = enrollment_id
      AND public.is_org_admin(public.ce_org_of_course(e.course_id), auth.uid())
  ));

-- ce_quiz_attempts
CREATE POLICY "user views own attempts" ON public.ce_quiz_attempts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "user inserts own attempts" ON public.ce_quiz_attempts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins view org attempts" ON public.ce_quiz_attempts
  FOR SELECT TO authenticated
  USING (public.is_org_admin(public.ce_org_of_lesson(lesson_id), auth.uid()));

-- ============ updated_at triggers ============
CREATE TRIGGER trg_ce_courses_updated BEFORE UPDATE ON public.ce_courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ce_lessons_updated BEFORE UPDATE ON public.ce_lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ce_questions_updated BEFORE UPDATE ON public.ce_quiz_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
