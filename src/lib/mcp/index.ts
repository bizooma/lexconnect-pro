import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyOrganizations from "./tools/list-my-organizations";
import whoami from "./tools/whoami";
import listQaPosts from "./tools/list-qa-posts";
import getQaPost from "./tools/get-qa-post";
import createQaPost from "./tools/create-qa-post";
import replyToQaPost from "./tools/reply-to-qa-post";
import listConversations from "./tools/list-conversations";
import getConversation from "./tools/get-conversation";
import sendMessage from "./tools/send-message";
import listMentorships from "./tools/list-mentorships";
import requestMentorship from "./tools/request-mentorship";
import listCeCourses from "./tools/list-ce-courses";
import getCeCourse from "./tools/get-ce-course";
import listWebsitePages from "./tools/list-website-pages";
import getWebsitePage from "./tools/get-website-page";

// The OAuth issuer MUST be the direct Supabase host, not the .lovable.cloud
// proxy that SUPABASE_URL points to on publish. VITE_SUPABASE_PROJECT_ID is
// inlined by Vite at build time; the sentinel keeps the issuer well-formed
// during the manifest-extract eval and is replaced with the real ref in
// production builds.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "lexguild-mcp",
  title: "LexGuild",
  version: "0.2.0",
  instructions:
    "Tools for LexGuild — a mentorship, Q&A, continuing-education, and website platform for bar associations and law firms. Start with `whoami` and `list_my_organizations` to discover the signed-in user's context. Q&A: `list_qa_posts`, `get_qa_post`, `create_qa_post`, `reply_to_qa_post`. Messaging: `list_conversations`, `get_conversation`, `send_message`. Mentorship: `list_mentorships`, `request_mentorship`. Continuing Education: `list_ce_courses`, `get_ce_course` (includes the user's own progress). Website builder: `list_website_pages`, `get_website_page`. All calls act as the signed-in user under row-level security.",
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
    listConversations,
    getConversation,
    sendMessage,
    listMentorships,
    requestMentorship,
    listCeCourses,
    getCeCourse,
    listWebsitePages,
    getWebsitePage,
  ],
});
