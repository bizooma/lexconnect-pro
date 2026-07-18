import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauth, err, ok } from "./_shared";

export default defineTool({
  name: "get_website_page",
  title: "Get website page",
  description:
    "Fetch a website builder page's full metadata plus its ordered sections (section_type, settings, content, visibility). Useful for reviewing or auditing a page's structure.",
  inputSchema: {
    pageId: z.string().uuid().describe("Page ID (from list_website_pages)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ pageId }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const sb = supabaseForUser(ctx);
    const { data: page, error: pErr } = await sb
      .from("website_pages")
      .select("id, organization_id, title, slug, page_type, status, meta_title, meta_description, og_title, og_description, og_image, published_at, scheduled_at, updated_at, created_at")
      .eq("id", pageId)
      .maybeSingle();
    if (pErr) return err(pErr.message);
    if (!page) return err("Page not found or not accessible.");

    const { data: sections, error: sErr } = await sb
      .from("website_sections")
      .select("id, section_type, display_order, visible, settings_json, content_json")
      .eq("page_id", pageId)
      .order("display_order", { ascending: true });
    if (sErr) return err(sErr.message);

    const payload = { page, sections: sections ?? [] };
    return ok(payload, payload as unknown as Record<string, unknown>);
  },
});
