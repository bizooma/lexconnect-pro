import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauth, err, ok } from "./_shared";

export default defineTool({
  name: "list_ce_courses",
  title: "List CE courses",
  description:
    "List published Continuing Education courses in an organization that the signed-in user has access to (self-enroll or assigned). Includes credit hours and lesson counts.",
  inputSchema: {
    organizationId: z.string().uuid().describe("Organization ID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ organizationId }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("ce_courses")
      .select("id, title, slug, description, credit_hours, status, allow_self_enroll, cover_image_url, created_at, ce_lessons(id)")
      .eq("organization_id", organizationId)
      .eq("status", "published")
      .order("created_at", { ascending: false });
    if (error) return err(error.message);
    const courses = (data ?? []).map((c: any) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      description: c.description,
      credit_hours: c.credit_hours,
      allow_self_enroll: c.allow_self_enroll,
      cover_image_url: c.cover_image_url,
      lesson_count: (c.ce_lessons ?? []).length,
      created_at: c.created_at,
    }));
    return ok(courses, { courses });
  },
});
