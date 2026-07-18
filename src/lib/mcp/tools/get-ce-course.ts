import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauth, err, ok } from "./_shared";

export default defineTool({
  name: "get_ce_course",
  title: "Get CE course with progress",
  description:
    "Fetch a Continuing Education course by ID including its lessons in order and the signed-in user's enrollment status and per-lesson progress.",
  inputSchema: {
    courseId: z.string().uuid().describe("Course ID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ courseId }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const uid = ctx.getUserId();
    const sb = supabaseForUser(ctx);

    const { data: course, error: courseErr } = await sb
      .from("ce_courses")
      .select("id, organization_id, title, slug, description, credit_hours, status, allow_self_enroll, cover_image_url, created_at")
      .eq("id", courseId)
      .maybeSingle();
    if (courseErr) return err(courseErr.message);
    if (!course) return err("Course not found or not accessible.");

    const { data: lessons, error: lessonsErr } = await sb
      .from("ce_lessons")
      .select("id, title, description, display_order, youtube_video_id, duration_seconds, required, has_quiz")
      .eq("course_id", courseId)
      .order("display_order", { ascending: true });
    if (lessonsErr) return err(lessonsErr.message);

    const { data: enrollment } = await sb
      .from("ce_enrollments")
      .select("id, status, enrolled_at, completed_at")
      .eq("course_id", courseId)
      .eq("user_id", uid)
      .maybeSingle();

    let progress: any[] = [];
    if (enrollment?.id) {
      const { data: prog } = await sb
        .from("ce_lesson_progress")
        .select("lesson_id, status, watched_seconds, completed_at")
        .eq("enrollment_id", enrollment.id);
      progress = prog ?? [];
    }

    const payload = { course, lessons: lessons ?? [], enrollment: enrollment ?? null, progress };
    return ok(payload, payload as unknown as Record<string, unknown>);
  },
});
