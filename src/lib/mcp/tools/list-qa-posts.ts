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
  name: "list_qa_posts",
  title: "List Q&A posts",
  description:
    "List recent Q&A posts (questions/discussions) in a LexGuild organization the user belongs to. Ordered by most recent activity. Returns at most `limit` posts (default 20, max 50).",
  inputSchema: {
    organizationId: z.string().uuid().describe("Organization ID (from list_my_organizations)."),
    limit: z.number().int().optional().describe("Max posts to return, 1-50. Default 20."),
    search: z.string().optional().describe("Optional full-text search term (matches title/body/tags)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ organizationId, limit, search }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const cap = Math.max(1, Math.min(limit ?? 20, 50));
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("qa_posts")
      .select("id, title, body, tags, status, is_urgent, is_pinned, reply_count, last_activity_at, created_at, author_id, is_anonymous")
      .eq("organization_id", organizationId)
      .order("last_activity_at", { ascending: false })
      .limit(cap);
    if (search && search.trim()) {
      q = q.textSearch("search_tsv", search.trim(), { type: "websearch" });
    }
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const posts = (data ?? []).map((p: any) => ({
      ...p,
      body: (p.body ?? "").slice(0, 400),
      author_id: p.is_anonymous ? null : p.author_id,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(posts, null, 2) }],
      structuredContent: { posts },
    };
  },
});
