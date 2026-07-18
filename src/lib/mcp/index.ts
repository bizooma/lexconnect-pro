import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyOrganizations from "./tools/list-my-organizations";
import whoami from "./tools/whoami";
import listQaPosts from "./tools/list-qa-posts";
import getQaPost from "./tools/get-qa-post";
import createQaPost from "./tools/create-qa-post";
import replyToQaPost from "./tools/reply-to-qa-post";

// The OAuth issuer MUST be the direct Supabase host, not the .lovable.cloud
// proxy that SUPABASE_URL points to on publish. VITE_SUPABASE_PROJECT_ID is
// inlined by Vite at build time; the sentinel keeps the issuer well-formed
// during the manifest-extract eval and is replaced with the real ref in
// production builds.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "lexguild-mcp",
  title: "LexGuild",
  version: "0.1.0",
  instructions:
    "Tools for LexGuild — a mentorship, Q&A, and continuing-education platform for bar associations and law firms. Use `whoami` and `list_my_organizations` first to discover the signed-in user's context, then `list_qa_posts` / `get_qa_post` to read discussions, and `create_qa_post` / `reply_to_qa_post` to participate. All calls act as the signed-in user under row-level security.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoami,
    listMyOrganizations,
    listQaPosts,
    getQaPost,
    createQaPost,
    replyToQaPost,
  ],
});
