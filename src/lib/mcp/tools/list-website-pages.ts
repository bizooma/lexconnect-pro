import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauth, err, ok } from "./_shared";

export default defineTool({
  name: "list_website_pages",
  title: "List website pages",
  description:
    "List website builder pages in an organization the signed-in user belongs to. Includes drafts, scheduled, published, and archived pages.",
  inputSchema: {
    organizationId: z.string().uuid().describe("Organization ID."),
    status: z
      .enum(["draft", "published", "scheduled", "archived"])
      .optional()
      .describe("Optional status filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ organizationId, status }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("website_pages")
      .select("id, title, slug, page_type, status, meta_title, meta_description, published_at, scheduled_at, updated_at")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false });
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return err(error.message);
    return ok(data ?? [], { pages: data ?? [] });
  },
});
