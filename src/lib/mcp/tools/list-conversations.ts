import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauth, err, ok } from "./_shared";

export default defineTool({
  name: "list_conversations",
  title: "List my conversations",
  description:
    "List direct-message conversations the signed-in user participates in, ordered by most recent activity. Includes other participants' user IDs and the last-message timestamp.",
  inputSchema: {
    limit: z.number().int().optional().describe("Max conversations to return, 1-50. Default 20."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const cap = Math.max(1, Math.min(limit ?? 20, 50));
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("conversations")
      .select("id, organization_id, last_message_at, created_at, conversation_participants(user_id)")
      .order("last_message_at", { ascending: false })
      .limit(cap);
    if (error) return err(error.message);
    const conversations = (data ?? []).map((c: any) => ({
      id: c.id,
      organization_id: c.organization_id,
      last_message_at: c.last_message_at,
      created_at: c.created_at,
      participant_ids: (c.conversation_participants ?? []).map((p: any) => p.user_id),
    }));
    return ok(conversations, { conversations });
  },
});
