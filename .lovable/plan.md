## Goal

Turn LexGuild from a single shared pool of attorneys into a true multi-tenant SaaS where each **organization** (law firm or bar association) is a tenant, an org admin pays Stripe per seat, and members get access while the seat is active.

## 1. Tenant data model (migration)

New tables:

- **`organizations`** — `name`, `slug`, `kind` (`firm` | `bar_association`), `created_by`, timestamps.
- **`organization_members`** — `organization_id`, `user_id`, `org_role` (`owner` | `admin` | `member`), `status` (`active` | `invited` | `removed`), `invited_email`, `invited_by`, `joined_at`. Unique `(organization_id, user_id)`.
- **`organization_invites`** — `organization_id`, `email`, `token`, `org_role`, `expires_at`, `accepted_at`. Used for "invite by email" flow.
- **`subscriptions`** — `organization_id` (unique), `stripe_customer_id`, `stripe_subscription_id`, `status` (`trialing` | `active` | `past_due` | `canceled` | `incomplete`), `plan` (`starter` | `pro` | `firm`), `seats_purchased`, `current_period_end`.

Extend existing tables with `organization_id uuid not null` (nullable during backfill, then set NOT NULL):

- `profiles`, `mentorships`, `conversations`, `meetings`, `notifications`.
- `messages` inherits scope through `conversations`.

Helper SECURITY DEFINER functions:

- `is_org_member(_org uuid, _user uuid) returns bool`
- `is_org_admin(_org uuid, _user uuid) returns bool` (owner or admin)
- `current_org_has_active_subscription(_org uuid) returns bool`

RLS rewrite — every existing policy on the tables above is replaced so that the row's `organization_id` must satisfy `is_org_member(organization_id, auth.uid())`. Mentorship/conversation/meeting policies additionally require the org's subscription to be active (read-only is allowed when past_due so users can still see their data; writes are blocked).

The current global `app_role` (`admin` | `member`) becomes a **platform** role only (LexGuild staff). Day-to-day "admin" inside a firm is `org_role` on `organization_members`.

## 2. Migration of existing data

A single migration:

1. Creates the new tables.
2. Inserts one default organization: `name = 'LexGuild'`, `kind = 'bar_association'`, `slug = 'lexguild'`.
3. Inserts every existing `profiles.user_id` into `organization_members` as `member`/`active` under that org. The first existing platform admin becomes `owner`.
4. Backfills `organization_id` on `profiles`, `mentorships`, `conversations`, `meetings`, `notifications` to that default org.
5. Sets columns NOT NULL and rewrites RLS.
6. Inserts a `subscriptions` row for the default org with `status = 'active'`, `plan = 'firm'`, `seats_purchased = <current member count>`, no Stripe IDs (grandfathered) so nothing breaks while billing is wired up.

## 3. Org context in the app

- New hook `useCurrentOrg()` — reads the user's memberships, picks an active org (persisted in localStorage), exposes `{ org, role, subscription, switchOrg }`.
- Wrap `/app` layout so every page reads `useCurrentOrg()` and every Supabase query filters by `organization_id`. Add an org switcher in the sidebar for users in multiple orgs.
- All existing screens (Discover, Dashboard, Messages, Meetings, Admin) get an `.eq('organization_id', org.id)` filter. Discover only shows fellow org members.

## 4. Org admin surfaces

New routes under `/app/org/`:

- **`/app/org/settings`** — name, slug, kind, danger zone.
- **`/app/org/members`** — list members, change `org_role`, remove. Invite by email (creates a row in `organization_invites` and sends a magic-link-style email via an edge function). Pending invites listed with resend/cancel.
- **`/app/org/billing`** — current plan, seat count, used vs. purchased, "Manage subscription" button that opens Stripe Customer Portal, "Buy more seats" button.
- **`/app/accept-invite/$token`** — public route. If signed in, joins the org. If not, prompts sign-in/up first, then joins.

Platform `/app/admin` stays, but is gated on `has_role(auth.uid(), 'admin')` and gains an "Organizations" tab to view/suspend any org.

## 5. Stripe (Lovable Payments)

Enable Lovable Payments via Stripe. Three plans created via `batch_create_product` after enable:

- **Starter** — $X/seat/month, up to 10 seats.
- **Pro** — $Y/seat/month, up to 50 seats.
- **Firm** — $Z/seat/month, unlimited.

Server functions (`createServerFn` with `requireSupabaseAuth`):

- `createCheckoutSession({ orgId, plan, seats })` — only org owners/admins. Returns Stripe Checkout URL with `client_reference_id = orgId`.
- `createCustomerPortalSession({ orgId })` — opens Stripe Customer Portal for that org's `stripe_customer_id`.
- `updateSeatCount({ orgId, seats })` — uses Stripe API to change quantity on the active subscription.

Webhook server route at `/api/public/stripe-webhook` (signature-verified):

- `checkout.session.completed` → upsert `subscriptions` row, set `status='active'`.
- `customer.subscription.updated` / `.deleted` → keep `status`, `seats_purchased`, `current_period_end` in sync.
- `invoice.payment_failed` → flip to `past_due` (RLS will auto-block writes).

A scheduled enforcement is not required — RLS reads `subscriptions.status` live.

## 6. Onboarding flow changes

Today `/onboarding` only sets `is_mentor`/`is_mentee` on a profile. New flow on first sign-in:

1. **Org choice** — "Create a new organization" or "I have an invite code".
2. If create: name, kind, slug → creates org, makes user `owner`, redirects to `/app/org/billing` to start a trial/checkout.
3. If invite: enter token (or land here from the email link) → joins as `member`.
4. Then the existing mentor/mentee step runs.

## 7. Seat enforcement

- Inserting into `organization_members` (status `active` or `invited`) checks the org's `subscriptions.seats_purchased` via a trigger; rejects if at cap.
- Org billing page surfaces "5 of 10 seats used" and warns at 80%.

## 8. Notifications & emails

Reuse the existing `notifications` table; add kinds: `org_invite_sent`, `org_invite_accepted`, `subscription_past_due`, `seat_limit_reached`. Email infra for the invite link is the only new email; everything else stays in-app for now.

---

### What stays the same

- Auth (email + Google).
- The collaboration loop (mentor matching, messages, meetings, voice notes) — all keep working, just scoped by org.
- The default `LexGuild` org keeps every current user functional from day one.

### What you'll need to do once after I implement

- Approve the migrations.
- Confirm enabling Lovable Payments via Stripe (form pops up).
- Tell me the 3 plan prices to create.
- Decide whether the default `LexGuild` org should be marked as a paying customer or stay grandfathered.

### Out of scope for this plan (say the word and I'll add)

- SSO / SAML per org.
- Per-org custom branding (logo, domain).
- Cross-org mentor discovery (mentor in firm A mentors associate in firm B).
- Annual billing toggle, coupons, free trial length tuning.
- Usage-based add-ons (extra storage for voice notes, etc.).
