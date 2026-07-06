import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- YouTube URL parser ----------
export function parseYoutubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.slice(1) || null;
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(embed|shorts|v)\/([^/?#]+)/);
      if (m) return m[2];
    }
    return null;
  } catch {
    return null;
  }
}

async function assertOrgAdmin(ctx: { supabase: any; userId: string }, orgId: string) {
  const { data, error } = await ctx.supabase.rpc("is_org_admin", { _org: orgId, _user: ctx.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

async function orgOfCourse(ctx: { supabase: any }, courseId: string): Promise<string> {
  const { data, error } = await ctx.supabase.from("ce_courses").select("organization_id").eq("id", courseId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Course not found");
  return data.organization_id as string;
}

async function orgOfLesson(ctx: { supabase: any }, lessonId: string): Promise<string> {
  const { data, error } = await ctx.supabase
    .from("ce_lessons")
    .select("course_id, ce_courses!inner(organization_id)")
    .eq("id", lessonId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lesson not found");
  return (data as any).ce_courses.organization_id as string;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "course";
}

// ============ ADMIN: COURSES ============
export const listOrgCourses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context, data.orgId);
    const { data: rows, error } = await context.supabase
      .from("ce_courses")
      .select("id, title, slug, status, credit_hours, allow_self_enroll, updated_at, created_at")
      .eq("organization_id", data.orgId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; title: string; description?: string; credit_hours?: number }) => d)
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context, data.orgId);
    const slug = `${slugify(data.title)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: row, error } = await context.supabase
      .from("ce_courses")
      .insert({
        organization_id: data.orgId,
        title: data.title,
        slug,
        description: data.description ?? null,
        credit_hours: data.credit_hours ?? 0,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const updateCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    courseId: string;
    title?: string;
    description?: string | null;
    cover_image_url?: string | null;
    credit_hours?: number;
    allow_self_enroll?: boolean;
    status?: "draft" | "published" | "archived";
  }) => d)
  .handler(async ({ data, context }) => {
    const org = await orgOfCourse(context, data.courseId);
    await assertOrgAdmin(context, org);
    const { courseId, ...patch } = data;
    const { error } = await context.supabase.from("ce_courses").update(patch).eq("id", courseId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { courseId: string }) => d)
  .handler(async ({ data, context }) => {
    const org = await orgOfCourse(context, data.courseId);
    await assertOrgAdmin(context, org);
    const { error } = await context.supabase.from("ce_courses").delete().eq("id", data.courseId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getCourseAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { courseId: string }) => d)
  .handler(async ({ data, context }) => {
    const org = await orgOfCourse(context, data.courseId);
    await assertOrgAdmin(context, org);
    const [{ data: course }, { data: lessons }] = await Promise.all([
      context.supabase.from("ce_courses").select("*").eq("id", data.courseId).single(),
      context.supabase
        .from("ce_lessons")
        .select("id, title, description, display_order, youtube_url, youtube_video_id, duration_seconds, required, has_quiz")
        .eq("course_id", data.courseId)
        .order("display_order"),
    ]);
    return { course, lessons: lessons ?? [] };
  });

// ============ ADMIN: LESSONS ============
export const upsertLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    lessonId?: string;
    courseId: string;
    title: string;
    description?: string | null;
    youtube_url: string;
    duration_seconds?: number | null;
    required?: boolean;
    has_quiz?: boolean;
    display_order?: number;
  }) => d)
  .handler(async ({ data, context }) => {
    const org = await orgOfCourse(context, data.courseId);
    await assertOrgAdmin(context, org);
    const vid = parseYoutubeId(data.youtube_url);
    if (!vid) throw new Error("Invalid YouTube URL");
    if (data.lessonId) {
      const { error } = await context.supabase.from("ce_lessons").update({
        title: data.title,
        description: data.description ?? null,
        youtube_url: data.youtube_url,
        youtube_video_id: vid,
        duration_seconds: data.duration_seconds ?? null,
        required: data.required ?? true,
        has_quiz: data.has_quiz ?? false,
      }).eq("id", data.lessonId);
      if (error) throw new Error(error.message);
      return { id: data.lessonId };
    }
    const { data: countRow } = await context.supabase
      .from("ce_lessons").select("id", { count: "exact", head: true }).eq("course_id", data.courseId);
    const order = data.display_order ?? (countRow as any)?.length ?? 0;
    const { data: row, error } = await context.supabase.from("ce_lessons").insert({
      course_id: data.courseId,
      title: data.title,
      description: data.description ?? null,
      youtube_url: data.youtube_url,
      youtube_video_id: vid,
      duration_seconds: data.duration_seconds ?? null,
      required: data.required ?? true,
      has_quiz: data.has_quiz ?? false,
      display_order: order,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lessonId: string }) => d)
  .handler(async ({ data, context }) => {
    const org = await orgOfLesson(context, data.lessonId);
    await assertOrgAdmin(context, org);
    const { error } = await context.supabase.from("ce_lessons").delete().eq("id", data.lessonId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderLessons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { courseId: string; orderedIds: string[] }) => d)
  .handler(async ({ data, context }) => {
    const org = await orgOfCourse(context, data.courseId);
    await assertOrgAdmin(context, org);
    for (let i = 0; i < data.orderedIds.length; i++) {
      await context.supabase.from("ce_lessons").update({ display_order: i }).eq("id", data.orderedIds[i]);
    }
    return { ok: true };
  });

// ============ ADMIN: QUIZ ============
export const getLessonQuizAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lessonId: string }) => d)
  .handler(async ({ data, context }) => {
    const org = await orgOfLesson(context, data.lessonId);
    await assertOrgAdmin(context, org);
    const [{ data: settings }, { data: questions }] = await Promise.all([
      context.supabase.from("ce_quiz_settings").select("*").eq("lesson_id", data.lessonId).maybeSingle(),
      context.supabase.from("ce_quiz_questions")
        .select("id, prompt, kind, multi_select, explanation, display_order, ce_quiz_options(id, label, is_correct, display_order)")
        .eq("lesson_id", data.lessonId)
        .order("display_order"),
    ]);
    return { settings, questions: questions ?? [] };
  });

export const upsertQuizSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lessonId: string; passing_score_pct: number; max_attempts: number | null; shuffle_questions: boolean }) => d)
  .handler(async ({ data, context }) => {
    const org = await orgOfLesson(context, data.lessonId);
    await assertOrgAdmin(context, org);
    const { error } = await context.supabase.from("ce_quiz_settings").upsert({
      lesson_id: data.lessonId,
      passing_score_pct: data.passing_score_pct,
      max_attempts: data.max_attempts,
      shuffle_questions: data.shuffle_questions,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    questionId?: string;
    lessonId: string;
    prompt: string;
    kind: "multiple_choice" | "true_false";
    multi_select: boolean;
    explanation?: string | null;
    display_order: number;
    options: { id?: string; label: string; is_correct: boolean; display_order: number }[];
  }) => d)
  .handler(async ({ data, context }) => {
    const org = await orgOfLesson(context, data.lessonId);
    await assertOrgAdmin(context, org);
    let qid = data.questionId;
    if (qid) {
      const { error } = await context.supabase.from("ce_quiz_questions").update({
        prompt: data.prompt, kind: data.kind, multi_select: data.multi_select,
        explanation: data.explanation ?? null, display_order: data.display_order,
      }).eq("id", qid);
      if (error) throw new Error(error.message);
      await context.supabase.from("ce_quiz_options").delete().eq("question_id", qid);
    } else {
      const { data: row, error } = await context.supabase.from("ce_quiz_questions").insert({
        lesson_id: data.lessonId,
        prompt: data.prompt, kind: data.kind, multi_select: data.multi_select,
        explanation: data.explanation ?? null, display_order: data.display_order,
      }).select("id").single();
      if (error) throw new Error(error.message);
      qid = row.id as string;
    }
    if (data.options.length > 0) {
      const { error } = await context.supabase.from("ce_quiz_options").insert(
        data.options.map((o) => ({
          question_id: qid, label: o.label, is_correct: o.is_correct, display_order: o.display_order,
        })),
      );
      if (error) throw new Error(error.message);
    }
    // Flip lesson.has_quiz true if any questions exist
    await context.supabase.from("ce_lessons").update({ has_quiz: true }).eq("id", data.lessonId);
    return { id: qid };
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { questionId: string; lessonId: string }) => d)
  .handler(async ({ data, context }) => {
    const org = await orgOfLesson(context, data.lessonId);
    await assertOrgAdmin(context, org);
    const { error } = await context.supabase.from("ce_quiz_questions").delete().eq("id", data.questionId);
    if (error) throw new Error(error.message);
    const { count } = await context.supabase.from("ce_quiz_questions")
      .select("id", { count: "exact", head: true }).eq("lesson_id", data.lessonId);
    if ((count ?? 0) === 0) {
      await context.supabase.from("ce_lessons").update({ has_quiz: false }).eq("id", data.lessonId);
    }
    return { ok: true };
  });

// ============ ADMIN: ASSIGNMENTS ============
export const listAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { courseId: string }) => d)
  .handler(async ({ data, context }) => {
    const org = await orgOfCourse(context, data.courseId);
    await assertOrgAdmin(context, org);
    const { data: rows, error } = await context.supabase
      .from("ce_assignments")
      .select("id, assignee_user_id, assignee_role, due_at, required, created_at")
      .eq("course_id", data.courseId);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const assignCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    courseId: string;
    assignee_user_id?: string | null;
    assignee_role?: "owner" | "admin" | "content_editor" | "member" | null;
    due_at?: string | null;
    required?: boolean;
  }) => d)
  .handler(async ({ data, context }) => {
    const org = await orgOfCourse(context, data.courseId);
    await assertOrgAdmin(context, org);
    if ((data.assignee_user_id ? 1 : 0) + (data.assignee_role ? 1 : 0) !== 1) {
      throw new Error("Pick either a user or a role");
    }
    const { error } = await context.supabase.from("ce_assignments").insert({
      course_id: data.courseId,
      assignee_user_id: data.assignee_user_id ?? null,
      assignee_role: data.assignee_role ?? null,
      due_at: data.due_at ?? null,
      required: data.required ?? true,
      assigned_by: context.userId,
    });
    if (error) throw new Error(error.message);

    // Notify individually assigned user
    if (data.assignee_user_id) {
      const { data: course } = await context.supabase
        .from("ce_courses").select("title, organization_id").eq("id", data.courseId).single();
      if (course) {
        await context.supabase.from("notifications").insert({
          user_id: data.assignee_user_id,
          organization_id: course.organization_id,
          kind: "ce_assignment",
          title: "New course assigned",
          body: `"${course.title}" has been assigned to you.`,
          link: `/app/ce/${data.courseId}`,
          related_id: data.courseId,
        });
      }
    }
    return { ok: true };
  });

export const unassign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { assignmentId: string }) => d)
  .handler(async ({ data, context }) => {
    // Verify admin via join
    const { data: row } = await context.supabase
      .from("ce_assignments").select("course_id").eq("id", data.assignmentId).single();
    if (!row) throw new Error("Not found");
    const org = await orgOfCourse(context, row.course_id);
    await assertOrgAdmin(context, org);
    const { error } = await context.supabase.from("ce_assignments").delete().eq("id", data.assignmentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ ADMIN: RESULTS ============
export const listOrgResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; courseId?: string | null }) => d)
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context, data.orgId);
    let q = context.supabase
      .from("ce_enrollments")
      .select("id, user_id, course_id, status, enrolled_at, completed_at, ce_courses!inner(title, organization_id, credit_hours)")
      .eq("ce_courses.organization_id", data.orgId)
      .order("enrolled_at", { ascending: false });
    if (data.courseId) q = q.eq("course_id", data.courseId);
    const { data: enrollments, error } = await q;
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((enrollments ?? []).map((e: any) => e.user_id)));
    const { data: profs } = userIds.length
      ? await context.supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
      : { data: [] as any[] };
    const map = new Map((profs ?? []).map((p: any) => [p.user_id, p.full_name]));
    return (enrollments ?? []).map((e: any) => ({
      ...e,
      member_name: map.get(e.user_id) ?? "Unknown",
    }));
  });

export const getMemberTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context, data.orgId);
    const { data: enrollments } = await context.supabase
      .from("ce_enrollments")
      .select("id, course_id, status, enrolled_at, completed_at, ce_courses!inner(title, organization_id, credit_hours)")
      .eq("user_id", data.userId)
      .eq("ce_courses.organization_id", data.orgId);
    const { data: attempts } = await context.supabase
      .from("ce_quiz_attempts")
      .select("id, lesson_id, attempt_no, score_pct, passed, submitted_at, ce_lessons!inner(title, course_id, ce_courses!inner(title, organization_id))")
      .eq("user_id", data.userId)
      .eq("ce_lessons.ce_courses.organization_id", data.orgId)
      .order("submitted_at", { ascending: false });
    return { enrollments: enrollments ?? [], attempts: attempts ?? [] };
  });

// ============ MEMBER ============
export const listMyCourses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string }) => d)
  .handler(async ({ data, context }) => {
    // Assigned individually
    const { data: userAssigns } = await context.supabase
      .from("ce_assignments")
      .select("course_id, due_at, required, ce_courses!inner(id, title, description, cover_image_url, credit_hours, status, organization_id)")
      .eq("assignee_user_id", context.userId)
      .eq("ce_courses.organization_id", data.orgId)
      .eq("ce_courses.status", "published");
    // Assigned to role — find user's role in org
    const { data: mem } = await context.supabase
      .from("organization_members").select("org_role").eq("organization_id", data.orgId).eq("user_id", context.userId).eq("status", "active").maybeSingle();
    let roleAssigns: any[] = [];
    if (mem?.org_role) {
      const { data: rows } = await context.supabase
        .from("ce_assignments")
        .select("course_id, due_at, required, ce_courses!inner(id, title, description, cover_image_url, credit_hours, status, organization_id)")
        .eq("assignee_role", mem.org_role)
        .eq("ce_courses.organization_id", data.orgId)
        .eq("ce_courses.status", "published");
      roleAssigns = rows ?? [];
    }
    const seen = new Set<string>();
    const combined = [...(userAssigns ?? []), ...roleAssigns].filter((a: any) => {
      if (seen.has(a.course_id)) return false;
      seen.add(a.course_id);
      return true;
    });
    const { data: enrolls } = await context.supabase
      .from("ce_enrollments").select("course_id, status, completed_at").eq("user_id", context.userId);
    const enrollMap = new Map((enrolls ?? []).map((e: any) => [e.course_id, e]));

    // Self-enrolled published catalog
    const { data: catalog } = await context.supabase
      .from("ce_courses")
      .select("id, title, description, cover_image_url, credit_hours, status, organization_id, allow_self_enroll")
      .eq("organization_id", data.orgId)
      .eq("status", "published")
      .eq("allow_self_enroll", true);

    const totalHours = (enrolls ?? [])
      .filter((e: any) => e.status === "completed")
      .reduce((sum: number, e: any) => {
        const c = combined.find((a: any) => a.course_id === e.course_id);
        return sum + Number(c?.ce_courses?.credit_hours ?? 0);
      }, 0);

    return {
      assigned: combined.map((a: any) => ({
        ...a.ce_courses,
        due_at: a.due_at,
        required: a.required,
        enrollment: enrollMap.get(a.course_id) ?? null,
      })),
      catalog: (catalog ?? []).filter((c: any) => !seen.has(c.id)).map((c: any) => ({
        ...c, enrollment: enrollMap.get(c.id) ?? null, due_at: null, required: false,
      })),
      totalHours,
    };
  });

export const getCourseMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { courseId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: course, error: cErr } = await context.supabase
      .from("ce_courses")
      .select("id, title, description, cover_image_url, credit_hours, status, organization_id, allow_self_enroll")
      .eq("id", data.courseId).maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!course) throw new Error("Not found");
    const { data: lessons } = await context.supabase
      .from("ce_lessons")
      .select("id, title, description, display_order, duration_seconds, required, has_quiz")
      .eq("course_id", data.courseId).order("display_order");
    const { data: enrollment } = await context.supabase
      .from("ce_enrollments").select("id, status, completed_at, enrolled_at")
      .eq("course_id", data.courseId).eq("user_id", context.userId).maybeSingle();
    let progress: any[] = [];
    if (enrollment) {
      const { data } = await context.supabase
        .from("ce_lesson_progress")
        .select("lesson_id, video_watched_at, passed_at, best_score_pct")
        .eq("enrollment_id", enrollment.id);
      progress = data ?? [];
    }
    return { course, lessons: lessons ?? [], enrollment, progress };
  });

export const startEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { courseId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("ce_enrollments").select("id").eq("course_id", data.courseId).eq("user_id", context.userId).maybeSingle();
    if (existing) return { id: existing.id };
    const { data: row, error } = await context.supabase
      .from("ce_enrollments").insert({ course_id: data.courseId, user_id: context.userId }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const getLessonForPlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lessonId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: lesson, error } = await context.supabase
      .from("ce_lessons")
      .select("id, course_id, title, description, youtube_video_id, has_quiz, required, duration_seconds")
      .eq("id", data.lessonId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!lesson) throw new Error("Lesson not found");
    const { data: enrollment } = await context.supabase
      .from("ce_enrollments").select("id").eq("course_id", lesson.course_id).eq("user_id", context.userId).maybeSingle();
    let progress: any = null;
    if (enrollment) {
      const { data } = await context.supabase.from("ce_lesson_progress")
        .select("*").eq("enrollment_id", enrollment.id).eq("lesson_id", data.lessonId).maybeSingle();
      progress = data;
    }
    let quiz: { settings: any; questions: any[] } | null = null;
    if (lesson.has_quiz) {
      const [{ data: settings }, { data: questions }] = await Promise.all([
        context.supabase.from("ce_quiz_settings").select("*").eq("lesson_id", data.lessonId).maybeSingle(),
        context.supabase.from("ce_quiz_questions")
          .select("id, prompt, kind, multi_select, display_order, ce_quiz_options(id, label, display_order)")
          .eq("lesson_id", data.lessonId).order("display_order"),
      ]);
      quiz = { settings, questions: questions ?? [] };
    }
    const { count: attemptCount } = await context.supabase.from("ce_quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("lesson_id", data.lessonId).eq("user_id", context.userId);
    return { lesson, enrollment, progress, quiz, attemptsUsed: attemptCount ?? 0 };
  });

export const markVideoWatched = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lessonId: string; courseId: string }) => d)
  .handler(async ({ data, context }) => {
    let { data: enrollment } = await context.supabase
      .from("ce_enrollments").select("id").eq("course_id", data.courseId).eq("user_id", context.userId).maybeSingle();
    if (!enrollment) {
      const { data: row, error } = await context.supabase.from("ce_enrollments")
        .insert({ course_id: data.courseId, user_id: context.userId }).select("id").single();
      if (error) throw new Error(error.message);
      enrollment = row;
    }
    const { error } = await context.supabase.from("ce_lesson_progress").upsert({
      enrollment_id: enrollment!.id,
      lesson_id: data.lessonId,
      video_watched_at: new Date().toISOString(),
    }, { onConflict: "enrollment_id,lesson_id" });
    if (error) throw new Error(error.message);
    await maybeCompleteCourse(context, enrollment!.id, data.courseId);
    return { ok: true };
  });

async function maybeCompleteCourse(context: any, enrollmentId: string, courseId: string) {
  const { data: lessons } = await context.supabase
    .from("ce_lessons").select("id, required, has_quiz").eq("course_id", courseId);
  const { data: progress } = await context.supabase
    .from("ce_lesson_progress").select("lesson_id, video_watched_at, passed_at").eq("enrollment_id", enrollmentId);
  const pmap = new Map((progress ?? []).map((p: any) => [p.lesson_id, p]));
  const allDone = (lessons ?? []).filter((l: any) => l.required).every((l: any) => {
    const p = pmap.get(l.id);
    if (!p) return false;
    if (l.has_quiz) return !!p.passed_at;
    return !!p.video_watched_at;
  });
  if (allDone) {
    await context.supabase.from("ce_enrollments")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", enrollmentId).is("completed_at", null);
  }
}

export const submitQuizAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lessonId: string; courseId: string; answers: Record<string, string[]> }) => d)
  .handler(async ({ data, context }) => {
    // Load questions with correct options (RLS admin path won't apply — but member can't SELECT questions via RLS.
    // Read via the admin path bypass? No — use security definer helper? We'll use supabaseAdmin.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Confirm access
    const { data: lesson } = await supabaseAdmin.from("ce_lessons")
      .select("id, course_id, ce_courses!inner(organization_id)").eq("id", data.lessonId).single();
    if (!lesson) throw new Error("Lesson not found");
    const { data: access } = await supabaseAdmin.rpc("ce_user_can_access_course", {
      _course_id: lesson.course_id, _user_id: context.userId,
    });
    if (!access) throw new Error("Forbidden");

    const { data: questions } = await supabaseAdmin
      .from("ce_quiz_questions")
      .select("id, multi_select, ce_quiz_options(id, is_correct)")
      .eq("lesson_id", data.lessonId);
    const { data: settings } = await supabaseAdmin
      .from("ce_quiz_settings").select("*").eq("lesson_id", data.lessonId).maybeSingle();
    const passingPct = settings?.passing_score_pct ?? 80;
    const maxAttempts = settings?.max_attempts ?? null;

    // Attempts used
    const { count: used } = await supabaseAdmin.from("ce_quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("lesson_id", data.lessonId).eq("user_id", context.userId);
    if (maxAttempts !== null && (used ?? 0) >= maxAttempts) {
      throw new Error("Maximum attempts reached");
    }

    let correctCount = 0;
    const perQuestion: any[] = [];
    for (const q of questions ?? []) {
      // @ts-expect-error dynamic join
      const correctIds = new Set(q.ce_quiz_options.filter((o: any) => o.is_correct).map((o: any) => o.id));
      const given = new Set(data.answers[q.id] ?? []);
      let ok = false;
      if (given.size === correctIds.size) {
        ok = Array.from(given).every((id) => correctIds.has(id));
      }
      if (ok) correctCount++;
      perQuestion.push({ question_id: q.id, given: Array.from(given), correct: Array.from(correctIds), ok });
    }
    const total = (questions ?? []).length;
    const scorePct = total === 0 ? 0 : Math.round((correctCount / total) * 100);
    const passed = scorePct >= passingPct;

    // Enrollment
    let { data: enrollment } = await supabaseAdmin
      .from("ce_enrollments").select("id").eq("course_id", data.courseId).eq("user_id", context.userId).maybeSingle();
    if (!enrollment) {
      const { data: row } = await supabaseAdmin.from("ce_enrollments")
        .insert({ course_id: data.courseId, user_id: context.userId }).select("id").single();
      enrollment = row!;
    }

    await supabaseAdmin.from("ce_quiz_attempts").insert({
      lesson_id: data.lessonId,
      user_id: context.userId,
      enrollment_id: enrollment.id,
      attempt_no: (used ?? 0) + 1,
      score_pct: scorePct,
      passed,
      answers_json: { per_question: perQuestion, answers: data.answers },
    });

    // Progress row
    const { data: existingProg } = await supabaseAdmin.from("ce_lesson_progress")
      .select("best_score_pct, passed_at, video_watched_at")
      .eq("enrollment_id", enrollment.id).eq("lesson_id", data.lessonId).maybeSingle();
    const bestScore = Math.max(scorePct, existingProg?.best_score_pct ?? 0);
    await supabaseAdmin.from("ce_lesson_progress").upsert({
      enrollment_id: enrollment.id,
      lesson_id: data.lessonId,
      video_watched_at: existingProg?.video_watched_at ?? new Date().toISOString(),
      passed_at: passed ? (existingProg?.passed_at ?? new Date().toISOString()) : existingProg?.passed_at ?? null,
      best_score_pct: bestScore,
    }, { onConflict: "enrollment_id,lesson_id" });

    if (passed) {
      await maybeCompleteCourse({ supabase: supabaseAdmin }, enrollment.id, data.courseId);
    }

    return { scorePct, passed, correctCount, total, attemptsUsed: (used ?? 0) + 1, maxAttempts };
  });

export const listOrgMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context, data.orgId);
    const { data: members } = await context.supabase
      .from("organization_members")
      .select("user_id, org_role, profiles:profiles!inner(user_id, full_name)")
      .eq("organization_id", data.orgId).eq("status", "active");
    return (members ?? []).map((m: any) => ({
      user_id: m.user_id, org_role: m.org_role, full_name: m.profiles?.full_name ?? "Unknown",
    }));
  });
