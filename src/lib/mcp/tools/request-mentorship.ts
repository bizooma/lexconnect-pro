import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauth, err, ok } from "./_shared";

export default defineTool({
  name: "request_mentorship",
  title: "Request mentorship",
  description:
    "Send a mentorship request to another org member. The signed-in user becomes the mentee and the target user becomes the mentor. The other party will receive an in-app notification and must accept before the mentorship becomes active.",
  inputSchema: {
    organizationId: z.string().uuid().describe("Organization the mentorship is in."),
    mentorUserId: z.string().uuid().describe("User ID of the desired mentor."),
    introMessage: z.string().optional().describe("Optional message to introduce yourself."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ organizationId, mentorUserId, introMessage }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const uid = ctx.getUserId();
    if (uid === mentorUserId) return err("You cannot request mentorship from yourself.");
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("mentorships")
      .insert({
        organization_id: organizationId,
        mentor_id: mentorUserId,
        mentee_id: uid,
        requested_by: uid,
        intro_message: introMessage ?? null,
        status: "pending",
      })
      .select("id, status, created_at")
      .single();
    if (error) return err(error.message);
    return ok({ ok: true, mentorship: data }, { mentorship: data });
  },
});
