import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauth, err, ok } from "./_shared";

export default defineTool({
  name: "list_mentorships",
  title: "List my mentorships",
  description:
    "List mentorship relationships the signed-in user is part of (as mentor or mentee), optionally filtered by status.",
  inputSchema: {
    organizationId: z.string().uuid().optional().describe("Optional org filter."),
    status: z
      .enum(["pending", "active", "declined", "ended"])
      .optional()
      .describe("Optional status filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ organizationId, status }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("mentorships")
      .select("id, mentor_id, mentee_id, status, intro_message, organization_id, requested_by, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (organizationId) q = q.eq("organization_id", organizationId);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return err(error.message);
    return ok(data ?? [], { mentorships: data ?? [] });
  },
});
