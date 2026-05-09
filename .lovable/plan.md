## Goal

Adopt the refined three-tier pricing across the site, with a monthly/annual toggle (annual saves ~2 months).

## Final pricing

| Tier | Monthly | Annual | Seats | Audience |
|---|---|---|---|---|
| Starter | $399/mo | $3,990/yr | Up to 25 | Pilot programs, small firms |
| Professional (most popular) | $899/mo | $8,990/yr | Up to 100 | Mid-sized bars, regional groups, larger firms |
| Enterprise | Custom (from $2,500/mo) | Custom | 250+ | State bars, multi-location, law schools |

Annual = 10× monthly (≈2 months free). Enterprise shows "Contact sales" instead of a price.

## Feature lists per tier

**Starter** — Up to 25 members · 1 admin · Invite links & codes · Messaging · Mentorship matching · Meeting scheduling · Mobile PWA access · Basic analytics

**Professional** (everything in Starter, plus) — Up to 100 members · Multiple admins · Admin matching controls · Voice notes · Organization branding · Mentorship reporting · Enhanced analytics · Priority support

**Enterprise** (everything in Professional, plus) — 250+ members · Custom branding · Advanced reporting · Custom onboarding · Dedicated success manager · SSO (roadmap) · API access (roadmap) · White-label (roadmap)

## Changes

### 1. `src/routes/index.tsx` — pricing section
- Replace the existing 3-card pricing block with new tiers and feature lists above.
- Add a monthly/annual segmented toggle above the cards (client state, no persistence).
- When annual is selected: show `$3,990/yr` (with `$399/mo billed annually` underneath) and a small "Save 2 months" badge near the toggle.
- Enterprise card always shows "Custom" / "Contact sales" → links to `#contact`.
- Keep "Most popular" ribbon on Professional.

### 2. `src/routes/signup.tsx` — plan picker
- Replace the 4-item `PLANS` array with 3 tiers matching the landing page (Starter / Professional / Enterprise).
- Add `monthlyPrice` and `annualPrice` fields; store selected billing cycle in component state.
- Render the same monthly/annual toggle above the plan grid.
- Default selection: Professional, monthly.
- Enterprise card shows "Contact sales" — selecting it routes the user to the contact section / mailto rather than continuing the self-serve flow (or we keep it selectable and flag it for follow-up; recommend the former for clarity).

### 3. No backend changes
- Pricing is presentational only right now; no DB columns or Stripe wiring touched. The signup flow already stores org metadata without a price field, so this is purely UI.

## Open question (will default if no answer)

Enterprise behavior on the signup page — default plan is to **disable self-serve selection** and show a "Contact sales" button that scrolls to the landing contact section. Say the word if you'd rather keep it selectable as-is.
