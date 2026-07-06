
# CE Learning Module — LMS Plan

Replaces the current placeholder at `/app/cle` with a full learning system, scoped per organization. Org admins (owner/admin) manage courses; assigned members watch embedded YouTube lessons and take quizzes; admins see results.

## Structure

Flat: **Course → Lessons** (each lesson has one embedded YouTube video and one optional quiz). Course completion = all required lessons passed.

## Data model (new tables, all org-scoped, RLS on)

- **ce_courses** — `organization_id`, `title`, `slug`, `description`, `cover_image_url`, `credit_hours` (numeric), `status` (`draft`|`published`|`archived`), `created_by`, timestamps.
- **ce_lessons** — `course_id`, `title`, `display_order`, `youtube_url` (validated to youtube.com/youtu.be), `youtube_video_id` (parsed), `description`, `duration_seconds`, `required` (bool), `has_quiz` (bool).
- **ce_quiz_questions** — `lesson_id`, `display_order`, `prompt`, `kind` (`multiple_choice`|`true_false`), `multi_select` (bool), `explanation`.
- **ce_quiz_options** — `question_id`, `display_order`, `label`, `is_correct`.
- **ce_quiz_settings** — one row per lesson: `passing_score_pct` (default 80), `max_attempts` (nullable = unlimited), `shuffle_questions` (bool).
- **ce_assignments** — `course_id`, `assignee_user_id` (nullable), `assignee_role` (nullable org_role), `due_at` (nullable), `required` (bool), `assigned_by`. One row per user OR per role; expansion happens at query time.
- **ce_enrollments** — `course_id`, `user_id`, `enrolled_at`, `completed_at`, `status` (`in_progress`|`completed`).
- **ce_lesson_progress** — `enrollment_id`, `lesson_id`, `video_watched_at`, `passed_at`, `best_score_pct`.
- **ce_quiz_attempts** — `lesson_id`, `user_id`, `enrollment_id`, `attempt_no`, `score_pct`, `passed`, `started_at`, `submitted_at`, `answers_json` (full snapshot for review).

Grants + RLS:
- Members: read `ce_courses` (published + assigned to them), read lessons/questions/options for those courses (options WITHOUT `is_correct` handled via a view or via a server fn that strips it before returning), read/write their own enrollments/progress/attempts.
- Org admins: full read/write within their org via `is_org_admin(org, uid)`.
- Question option correctness is never sent to member clients — grading runs in a `createServerFn`.

## Server functions (`src/lib/ce.functions.ts`)

Auth: `requireSupabaseAuth` middleware.
- Admin: `createCourse`, `updateCourse`, `publishCourse`, `archiveCourse`, `deleteCourse`, `upsertLesson`, `reorderLessons`, `upsertQuestion`, `reorderQuestions`, `upsertQuizSettings`, `assignCourse` (to user or role), `unassign`.
- Member: `listMyCourses`, `getCourseWithLessons` (strips `is_correct`), `startEnrollment`, `markVideoWatched`, `startQuizAttempt`, `submitQuizAttempt` (grades server-side, writes attempt, updates progress, completes enrollment when all required lessons passed, respects `max_attempts`).
- Admin analytics: `listCourseResults(course_id)`, `listMemberProgress(user_id)`, `getAttemptDetail(attempt_id)`.

## Routes

Member-facing (under `_authenticated` via existing `/app` layout):
- `app.ce.tsx` — layout + tabs.
- `app.ce.index.tsx` — "My Learning": assigned + in-progress + completed courses, credit hours earned.
- `app.ce.catalog.tsx` — all published courses in org, self-enroll where allowed.
- `app.ce.$courseId.tsx` — course overview + lesson list with progress checkmarks.
- `app.ce.$courseId.$lessonId.tsx` — YouTube embed (react-lite-youtube-embed or plain iframe), then quiz UI if present. Video-watched button unlocks quiz; quiz shows question-by-question with submit at end, immediate pass/fail + score, retry button when attempts remain.

Admin-facing (gated on `isOrgAdmin`):
- `app.ce.admin.tsx` — admin layout with tabs: Courses, Assignments, Results.
- `app.ce.admin.index.tsx` — course list, create/edit/publish/archive, drag-reorder lessons.
- `app.ce.admin.course.$courseId.tsx` — edit course meta, lessons, quizzes (question editor with option toggles for `is_correct`), settings (passing score, max attempts, shuffle).
- `app.ce.admin.assignments.tsx` — assign courses to members or roles, set due dates.
- `app.ce.admin.results.tsx` — table of enrollments with filters (course, member, status), CSV export, click into attempt detail to see per-question answers.
- `app.ce.admin.member.$userId.tsx` — per-member transcript: enrollments, lessons, attempts, total credit hours.

Nav: replace the current "CLE & Learning" entry with **"CE Learning"** pointing to `/app/ce`. Delete `app.cle.tsx`.

## UX details

- YouTube embed via privacy-enhanced `youtube-nocookie.com/embed/{id}`. Parser accepts youtu.be short links and `?v=` URLs; reject others in the admin form.
- Video "watched" is user-marked (YouTube iframe doesn't reliably report completion cross-origin without the IFrame API; can add IFrame API listener later for auto-detect).
- Quiz: one question per screen with a progress bar; on submit, show correct/incorrect per question with the stored `explanation`.
- Retake button visible only when `attempts_used < max_attempts` (or unlimited).
- Credit hours: sum `credit_hours` across completed courses on the member dashboard; admin results view shows per-course + per-member totals.
- Notifications (reuses existing `notifications` table + push): on new assignment, on due date approaching (7d, 1d), on completion (to admin), on failure after final attempt (to admin).
- Assignments to roles are expanded via SQL join with `organization_members`; new members joining an org automatically inherit role-based assignments.

## Access, pricing, seats

- Available to all orgs; no separate paywall for v1. Later, gate via a subscription flag if needed.
- Platform admins can view any org's CE data through the existing admin org-context switcher.

## Not included (explicitly deferred)

- Certificates / PDF generation.
- SCORM/xAPI, external content packages.
- Uploaded video files (YouTube embed only).
- Free-response / essay questions and manual grading.
- Discussions per lesson (Q&A module already exists).
- Live cohorts, sessions, scheduled starts.
- Prerequisites between courses.
- Per-question weighting (all questions weighted equally).
- Anti-cheat proctoring, IP locking, browser lockdown.
- Automated CE credit reporting to state bars.

## Rollout order

1. Migration: tables, grants, RLS, `is_org_admin` reuse.
2. Server fns + YouTube URL parser.
3. Admin course/lesson/quiz editor.
4. Member course/lesson/quiz player.
5. Assignments UI + notifications wiring.
6. Admin results dashboard + CSV export.
7. Nav swap; remove `app.cle.tsx`.
