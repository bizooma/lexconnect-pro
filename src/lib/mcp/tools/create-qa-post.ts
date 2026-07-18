import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "create_qa_post",
  title: "Create Q&A post",
  description:
    "Post a new question or discussion in a LexGuild organization the signed-in user belongs to. Returns the created post ID.",
  inputSchema: {
    organizationId: z.string().uuid().describe("Organization ID to post in."),
    title: z.string().describe("Short question title."),
    body: z.string().describe("Full question body (markdown supported)."),
    tags: z.array(z.string()).optional().describe("Optional list of tags."),
    isUrgent: z.boolean().optional().describe("Mark the question as urgent."),
    isAnonymous: z.boolean().optional().describe("Post anonymously (author hidden to other members)."),
    categoryId: z.string().uuid().optional().describe("Optional Q&A category ID."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ organizationId, title, body, tags, isUrgent, isAnonymous, categoryId }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const t = title.trim();
    const b = body.trim();
    if (t.length < 3 || t.length > 200) {
      return { content: [{ type: "text", text: "Title must be 3-200 chars" }], isError: true };
    }
    if (b.length < 3) {
      return { content: [{ type: "text", text: "Body is required" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("qa_posts")
      .insert({
        organization_id: organizationId,
        author_id: ctx.getUserId(),
        title: t,
        body: b,
        tags: (tags ?? []).slice(0, 10),
        is_urgent: !!isUrgent,
        is_anonymous: !!isAnonymous,
        category_id: categoryId ?? null,
      })
      .select("id")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Created post ${data.id}` }],
      structuredContent: { id: data.id },
    };
  },
});
