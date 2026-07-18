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
  name: "get_qa_post",
  title: "Get Q&A post with replies",
  description:
    "Fetch a single Q&A post and its replies. Only returns posts in organizations the signed-in user belongs to.",
  inputSchema: {
    postId: z.string().uuid().describe("Q&A post ID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ postId }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data: post, error } = await sb
      .from("qa_posts")
      .select("id, organization_id, title, body, tags, status, is_urgent, is_pinned, is_anonymous, author_id, best_answer_id, reply_count, created_at, last_activity_at")
      .eq("id", postId)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!post) return { content: [{ type: "text", text: "Post not found or not accessible" }], isError: true };

    const { data: replies, error: rErr } = await sb
      .from("qa_replies")
      .select("id, body, author_id, is_private, helpful_count, parent_reply_id, created_at, edited_at, deleted_at")
      .eq("post_id", postId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (rErr) return { content: [{ type: "text", text: rErr.message }], isError: true };

    const payload = {
      post: { ...post, author_id: post.is_anonymous ? null : post.author_id },
      replies: replies ?? [],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
