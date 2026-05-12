## Community Q&A — Implementation Plan

A new top-level module that replaces email listservs with a clean, mobile-first legal discussion board. Strictly scoped per organization (multi-tenant), matching the existing LexGuild design language (navy/white/gold, rounded cards, serif headings).

---

### 1. Database (Supabase migration)

New enums:
- `qa_post_status`: `open`, `resolved`, `closed`
- `qa_reaction_kind`: `helpful` (extensible)
- `qa_visibility`: reuse existing `resource_visibility` for attachments via existing `resources` table (new value `qa` added) OR a dedicated join.

New tables (every row carries `organization_id` + RLS via `is_org_member`):

| Table | Key columns |
|---|---|
| `qa_categories` | id, organization_id, name, slug, sort_order, archived |
| `qa_posts` | id, organization_id, author_id, category_id, title, body, tags text[], status, is_urgent, is_anonymous, allow_private_replies, is_pinned, reply_count, last_activity_at, best_answer_id (nullable) |
| `qa_replies` | id, post_id, organization_id, author_id, parent_reply_id (threaded), body, is_private, helpful_count, edited_at, deleted_at |
| `qa_post_attachments` | id, post_id, organization_id, resource_id (FK to existing `resources`) |
| `qa_reply_attachments` | id, reply_id, organization_id, resource_id |
| `qa_reactions` | id, target_type ('post'|'reply'), target_id, user_id, organization_id, kind, unique(target,user,kind) |
| `qa_follows` | user_id, post_id, organization_id, created_at, PK(user_id,post_id) |
| `qa_bookmarks` | user_id, post_id, organization_id, created_at, PK(user_id,post_id) |
| `qa_notification_prefs` | user_id, organization_id, mode ('all'|'my_posts'|'followed'|'digest'|'muted'), category_ids uuid[], updated_at |

Indexes: `(organization_id, last_activity_at desc)`, `(organization_id, category_id)`, GIN on `tags`, full-text GIN on `to_tsvector('english', title || ' ' || body)` for posts and replies.

Triggers:
- `qa_posts.reply_count` + `last_activity_at` maintained on reply insert/delete.
- On reply insert → enqueue `notifications` rows for: post author, all followers (respecting `qa_notification_prefs`), reusing existing `notifications` table + `dispatch_push_notification` trigger.
- On post insert → notify users whose practice areas overlap category (best-effort) or category subscribers, scoped to org.
- On `best_answer_id` set → notify reply author ("Marked as Best Answer").

RLS (every table):
- SELECT: `is_org_member(organization_id, auth.uid())` (private replies additionally require author or post author).
- INSERT: same + `org_can_write` + author = auth.uid().
- UPDATE/DELETE: author OR `is_org_admin`.
- Categories: read = members; write = `is_org_admin`.

Seed categories per existing org via migration loop: Estate Planning, Probate, Business Litigation, Family Law, Real Estate, Ethics, Technology, General Practice, Referrals, Court Procedures, Forms & Templates.

Storage: reuse existing `resources` bucket + `resources` table (adds `qa` to `resource_visibility` enum). Validation trigger already enforces 25MB + allowed mime types.

---

### 2. Routes (TanStack Start file-based)

```
src/routes/app.qa.tsx              layout with Outlet + tabs
src/routes/app.qa.index.tsx        feed (Recent / Trending / Unanswered / My Areas / Following)
src/routes/app.qa.ask.tsx          new question form
src/routes/app.qa.$postId.tsx      thread view (question + threaded replies)
src/routes/app.qa.search.tsx       search results
src/routes/app.qa.categories.tsx   browse by category
src/routes/app.qa.admin.tsx        admin moderation (org admins only)
```

Sidebar nav (`src/routes/app.tsx`): insert "Community Q&A" between Discover and Messages with a chat-bubble-stack icon. Update mobile bottom nav to handle 6 items (icon-only or condense).

---

### 3. UI components

`src/components/qa/`:
- `post-card.tsx` — title, author (or "Anonymous member"), category badge, tags, reply count, attachment paperclip, urgent/resolved/pinned badges, relative time.
- `ask-question-modal.tsx` — title, rich textarea, category select, tag chips input, file uploader (reuses `resource-uploader.tsx`), urgent/anon/private toggles.
- `reply-thread.tsx` — recursive threaded replies, "Helpful" reaction, reply box, author edit/delete, OP "Best Answer" button.
- `feed-tabs.tsx` — Recent | Trending | Unanswered | My Practice Areas | Following.
- `search-bar.tsx` + `filters-drawer.tsx` — category, status, has attachments, date range, sort.
- `notification-prefs-card.tsx` — added to `app.settings.tsx`.
- Confidentiality disclaimer banner on uploader.

Design tokens: navy (`--primary`), gold accent for "Best Answer" / pinned, muted gray badges, rounded-2xl cards, serif headings, matching existing dashboard.

---

### 4. Dashboard integration

In `app.dashboard.tsx` add a new section "From the Community" with three compact lists:
- Questions in my practice areas (matches `profiles.practice_areas` ↔ `qa_categories.name`)
- Unanswered questions (reply_count = 0, last 14 days)
- My followed discussions with new replies

---

### 5. Notifications & push

Reuse existing `notifications` table + `dispatch_push_notification` Postgres trigger + `/api/public/push.dispatch` route. New `kind` values: `qa_new_post`, `qa_reply`, `qa_best_answer`, `qa_followed_reply`, `qa_mention` (future).

Per-user `qa_notification_prefs` filters which inserts happen. Daily digest deferred to a follow-up (placeholder UI option only).

---

### 6. Search

Postgres full-text search via generated `tsvector` columns + GIN indexes. Server function `searchQa({ q, filters })` using `requireSupabaseAuth` middleware — RLS keeps results org-scoped automatically. Returns ranked posts + matching replies.

---

### 7. Admin moderation (`app.qa.admin.tsx`)

Visible only when `useCurrentOrg().isOrgAdmin`. Allows: pin/unpin, close, delete post, delete reply, manage categories (CRUD + reorder + archive), basic analytics (counts via aggregate queries).

---

### 8. Multi-tenant guarantees

- Every insert path sets `organization_id = useCurrentOrg().currentOrgId`.
- All RLS predicates use `is_org_member` / `is_org_admin` — never `auth.uid()` alone.
- Server functions read org from authenticated context, never trust client-provided org id for cross-org reads.
- Author display name omitted when `is_anonymous = true` (only shown to org admins on admin route).

---

### Out of scope (this iteration)

- Email digest scheduler (UI toggle only; pg_cron job to be added later).
- @mentions and DM-from-thread (existing Messages module covers DMs).
- Rich-text editor — use plain textarea + markdown rendering for v1.

---

### Technical notes (for devs)

- Threaded replies: single `qa_replies` table with self-referential `parent_reply_id`; render as 2-level nested in UI to keep mobile readable.
- Attachments use the existing `resources` + `message_resources`-style join pattern; no new bucket required.
- All mutations go through `createServerFn` with `requireSupabaseAuth` so RLS applies as the user.
- File path naming: `qa/{org_id}/{post_id}/{filename}` for storage objects (consistent with current resource patterns).

After approval I will land this in three commits: (1) migration + seed, (2) routes & components, (3) dashboard widgets + notification prefs + admin.
