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
  name: "reply_to_qa_post",
  title: "Reply to a Q&A post",
  description:
    "Add a reply to an existing Q&A post. Requires the signed-in user to be a member of the post's organization.",
  inputSchema: {
    postId: z.string().uuid().describe("Q&A post to reply to."),
    body: z.string().describe("Reply body (markdown supported)."),
    isPrivate: z.boolean().optional().describe("Private reply visible only to the post author (if the post allows it)."),
    parentReplyId: z.string().uuid().optional().describe("If replying inside a thread, the parent reply ID."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ postId, body, isPrivate, parentReplyId }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const b = body.trim();
    if (b.length < 1) {
      return { content: [{ type: "text", text: "Body is required" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    // Resolve organization_id from the post so we don't have to trust input.
    const { data: post, error: pErr } = await sb
      .from("qa_posts")
      .select("organization_id")
      .eq("id", postId)
      .maybeSingle();
    if (pErr) return { content: [{ type: "text", text: pErr.message }], isError: true };
    if (!post) return { content: [{ type: "text", text: "Post not found or not accessible" }], isError: true };

    const { data, error } = await sb
      .from("qa_replies")
      .insert({
        post_id: postId,
        organization_id: post.organization_id,
        author_id: ctx.getUserId(),
        body: b,
        is_private: !!isPrivate,
        parent_reply_id: parentReplyId ?? null,
      })
      .select("id")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Reply posted (${data.id})` }],
      structuredContent: { id: data.id },
    };
  },
});
