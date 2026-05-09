# Multi-Tenant SaaS Architecture — Phase 3

Builds on the org/member/invite/subscription foundation already in place. Stripe is deferred per your earlier call; the seat-cap and "upgrade plan" CTAs will be wired to a placeholder until billing is enabled.

## 1. Auth flow split

Today `/login` is a tabbed sign-in/sign-up that drops everyone into the default `LexGuild` org. Replace with three distinct routes:

- **`/login`** — sign-in only. Existing users land on `/app/dashboard` (or `/onboarding` if not yet onboarded).
- **`/signup`** — **organization signup only**. Creates the org, makes the user `owner`, then routes to a plan-selection step (placeholder pricing for now).
- **`/join`** and **`/join/$code`** — **member-only** signup/sign-in. Always attached to the org behind the invite code. No way to create an org from this flow.

Marketing CTAs on `/` are updated: "Start your organization" → `/signup`, "I have an invite" → `/join`.

## 2. New `/signup` flow (org creation)

Single-page wizard:

1. **Organization** — name, type (Bar Association / Law Firm / Legal Nonprofit / Law School / Attorney Group / Other), estimated seat count.
2. **Admin account** — full name, email, password (or "continue with Google").
3. **Plan** — 4 tiers (25 / 100 / 250 / Enterprise). For now the buttons set `subscription.plan` + `seats_purchased` and mark `status = 'trialing'`. A "Set up billing later" notice replaces real Stripe checkout.

Server function `createOrganizationWithOwner({ name, kind, slug, estSeats, plan })`:
- Inserts `organizations` (slug auto-generated from name, uniqueness-checked with numeric suffix on collision).
- Inserts `organization_members` row as `owner` / `active`.
- Inserts `subscriptions` row (`status='trialing'`, `seats_purchased` from plan).
- Returns the new org id; client switches `useCurrentOrg` to it.

## 3. New `/join` flow (member-only)

- `/join` — input box for invite code.
- `/join/$code` — auto-validates the code, shows "You're joining **{Org Name}**" with org logo, then prompts sign-in or sign-up.

Sign-up form is the member form (full name, email, password, practice area, years, interests, bio). On submit:
- Creates auth user.
- Inserts profile with locked `organization_id` (from code).
- Inserts `organization_members` row using the code's `role_assigned` (subject to seat cap trigger already in place).
- Increments `current_uses`.
- Routes into `/onboarding` (skipping the org-choice step).

The existing `accept-invite/$token` (email-targeted invites) stays for one-off email invites; codes are the new shareable mechanism.

## 4. Database changes

New table **`invite_codes`**:
- `organization_id`, `code` (8-char, unique), `role_assigned` (`org_role`), `expires_at` (nullable), `max_uses` (nullable = unlimited), `current_uses`, `active`, `created_by`, `created_at`.
- RLS: org admins manage; **public can SELECT a single row by code** (needed so an unauthenticated visitor on `/join/$code` can see the org name) — exposed via a SECURITY DEFINER `lookup_invite_code(code)` function returning only `{ org name, logo, role, valid }`, never the full row.

Extend **`organizations`**:
- `accent_color text` (hex, default brand color)
- `welcome_message text`

Extend **`subscriptions`**:
- `max_users int` (mirrors plan tier; `enforce_seat_limit` trigger updated to use this when set, falling back to `seats_purchased`).

Backfill: existing `LexGuild` org gets `max_users = 9999`, default accent color.

## 5. Dashboard widgets (org admin)

New `/app/org` overview page (linked from sidebar) with:
- Total members / active mentorships / pending invites / engagement (messages-this-week).
- **Seat utilization bar** "18 / 25 seats used" with "Upgrade plan" CTA (routes to `/app/org/billing`).
- Recent joins list.

Existing `/app/org/members` gets:
- "Generate invite code" button (creates row in `invite_codes`, shows shareable URL + copy button).
- "Bulk invite (CSV)" — paste/upload CSV of emails, creates one `organization_invites` row per email.
- Invite codes list with usage count, revoke toggle.

`/app/org/settings` gets logo upload (reuses `avatars` bucket with org-scoped path), accent color picker, welcome message textarea.

## 6. Branding application

`useCurrentOrg` exposes `org.accent_color`. App layout sets a CSS custom property `--org-accent` so org-scoped surfaces (sidebar active state, primary buttons inside `/app`) tint per org. Marketing routes keep the LexGuild brand.

`welcome_message` shows on `/app/dashboard` for new members on first login.

## 7. Tenancy hardening

Audit existing queries to ensure every `.from('profiles' | 'mentorships' | 'conversations' | 'meetings' | 'notifications')` has an `.eq('organization_id', currentOrgId)`. RLS already enforces this server-side, but explicit filters keep result sets clean across multi-org users.

`/app/discover` already filters by org — verify and add a guard so users without a current org are sent to `/onboarding`.

## 8. Stripe (still deferred)

`/app/org/billing` "Upgrade" + `/signup` plan step both call a stub `requestPlanChange()` that just updates `subscriptions.plan` + `seats_purchased`. When you say "enable Stripe", we swap in real checkout + webhook against the same shape — no UI rework needed.

---

## Out of scope for this phase

- Real Stripe checkout / customer portal / past_due enforcement.
- Custom domain per org / vanity URLs.
- Per-org email branding (auth emails stay LexGuild-branded until email infra is set up).
- SSO / SAML.

## What I need from you to start

1. Confirm the **plan tiers + seat caps** (25 / 100 / 250 / Enterprise) and whether to display placeholder prices (e.g. "$X/mo") or just "Contact us".
2. OK to keep email/password + Google on both `/signup` and `/join`? (Currently `/login` has both.)
3. Should the existing default `LexGuild` org be visible in the org switcher for everyone, or hidden once users belong to a real org?
