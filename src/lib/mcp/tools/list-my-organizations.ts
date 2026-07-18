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
  name: "list_my_organizations",
  title: "List my organizations",
  description:
    "List the LexGuild organizations (bar associations / law firms) the signed-in user belongs to.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("organization_members")
      .select("organization_id, org_role, status, organizations(id, name, slug, kind)")
      .eq("user_id", ctx.getUserId())
      .eq("status", "active");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const orgs = (data ?? []).map((r: any) => ({
      id: r.organizations?.id,
      name: r.organizations?.name,
      slug: r.organizations?.slug,
      kind: r.organizations?.kind,
      role: r.org_role,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(orgs, null, 2) }],
      structuredContent: { organizations: orgs },
    };
  },
});
