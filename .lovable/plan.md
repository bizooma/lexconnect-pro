## Goal

Cleanly separate two admin experiences:

- **Platform admin** (`user_roles.role = 'admin'`, e.g. joe@bizooma.com): system-wide view of every organization and every user.
- **Org admin** (`organization_members.org_role` in `owner`/`admin`): the existing per-org tools under `/app/org/*` (Overview, Insights, Matching, Members, Billing, Settings).

Today `/app/admin` is labeled "Bar Association Admin" and mixes the two — we just scoped it to the current org, which makes it a duplicate of `/app/org/members`. We'll repurpose `/app/admin` as the platform-admin-only area.

## Changes

### 1. Repurpose `/app/admin` as Platform Admin

Replace the contents of `src/routes/app.admin.tsx` with a platform-admin landing page, gated on `useIsAdmin()`. Layout: header "Platform Admin" + tabbed sub-sections.

Add three child routes:

- `src/routes/app.admin.orgs.tsx` — list of every organization
  - Columns: name, slug, kind (firm / bar association), member count, plan, subscription status, created date.
  - Row click → drawer or `/app/admin/orgs/$id` detail with members list and quick actions (impersonate-style "switch to this org" by writing `lexguild.currentOrgId` into localStorage and navigating to `/app/org`).
- `src/routes/app.admin.users.tsx` — list of every user/profile
  - Columns: name, email (from auth), org(s), platform role, mentor/mentee flags, joined date.
  - Search by name/email/firm. Filter by org.
  - Actions: grant/revoke platform `admin` role (writes to `user_roles`).
- `src/routes/app.admin.index.tsx` — small dashboard with counts (orgs, users, active subs, mentorships) and links to the two lists.

### 2. Sidebar / nav

In `src/routes/app.tsx`, keep the existing `Admin` nav item but only show it for platform admins (already the case via `useIsAdmin`). Rename label to "Platform" so it isn't confused with org admin.

The org-admin links already live in `OrgSwitcher` (Members, Billing, Settings, etc.) and are gated by `isOrgAdmin` — no change needed there. Joe will see those for any org where he's an owner/admin.

### 3. Data access

Platform-admin queries need to bypass per-org RLS. Existing RLS policies already allow `has_role(auth.uid(), 'admin')` to see all rows on `profiles`, `organizations`, `organization_members`, `mentorships`, `subscriptions`, so the client can query directly with the browser Supabase client — no server function needed.

For listing user emails (which live in `auth.users`, not `profiles`), we'll add a `createServerFn` using the admin Supabase client (`client.server`) that returns `{ id, email, created_at }` for all users, gated by a server-side `has_role(..., 'admin')` check.

### 4. Remove the per-org filtering hack we just added

Since `/app/admin` is becoming platform-only, we revert the `currentOrgId` filter in the existing admin file — but most of that file is being rewritten anyway as part of step 1.

## Out of scope

- Editing other orgs' settings as a platform admin (read-only for now; future work).
- Org-admin UX changes — those screens stay as-is.
- Audit logging of platform-admin actions.

## Open questions

None blocking — see questions below if you want to refine scope.
