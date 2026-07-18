import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauth, err, ok } from "./_shared";

export default defineTool({
  name: "send_message",
  title: "Send a message",
  description:
    "Send a text message in a conversation the signed-in user participates in. RLS enforces participation; other members will receive an in-app notification via existing triggers.",
  inputSchema: {
    conversationId: z.string().uuid().describe("Conversation ID."),
    body: z.string().min(1).describe("Message text."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ conversationId, body }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: ctx.getUserId(),
        body,
        kind: "text",
      })
      .select("id, created_at")
      .single();
    if (error) return err(error.message);
    return ok({ ok: true, message: data }, { message: data });
  },
});
