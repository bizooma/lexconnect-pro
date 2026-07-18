import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauth, err, ok } from "./_shared";

export default defineTool({
  name: "get_conversation",
  title: "Get conversation messages",
  description:
    "Fetch messages in a conversation the signed-in user participates in. Returns messages newest-first up to `limit` (default 50, max 200). Voice-note messages include an `audio_url` (signed URL not resolved here — treat as opaque storage path).",
  inputSchema: {
    conversationId: z.string().uuid().describe("Conversation ID (from list_conversations)."),
    limit: z.number().int().optional().describe("Max messages, 1-200. Default 50."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ conversationId, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const cap = Math.max(1, Math.min(limit ?? 50, 200));
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("messages")
      .select("id, sender_id, kind, body, audio_url, duration_seconds, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(cap);
    if (error) return err(error.message);
    const messages = data ?? [];
    return ok(messages, { messages });
  },
});
