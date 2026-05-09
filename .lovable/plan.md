## Mentorship Matching System

Build a real, scoreable matching engine plus tools for org admins to manually pair members. Two surfaces: **member-facing recommendations** and an **admin matching console**.

---

### 1. Scoring algorithm (shared util)

New file: `src/lib/matching.ts` — pure function, no DB calls, runs client-side over already-fetched org profiles.

For a given viewer (mentee or mentor), score every other org member 0–100:

- **Practice-area overlap** (0–40): Jaccard overlap on `practice_areas[]`, scaled.
- **Seniority complementarity** (0–25): mentor should have ≥5 more `years_experience` than mentee; reward mid-range gap (5–20 yrs), penalize inverted gaps.
- **Jurisdiction match** (0–15): same `state` = 15, neighboring/none = 0; bonus for shared `bar_admissions[]`.
- **Location proximity** (0–10): same `city` = 10, same `state` only = 5.
- **Availability** (0–10): mentor has `accepting_mentees = true` and a `meeting_cadence` set.
- **Hard filters** (exclude entirely): role mismatch (mentee viewing must see mentors only and vice versa), self, already in an active/pending mentorship together, mentor with `accepting_mentees = false`.

Returns `{ profile, score, reasons[] }` so the UI can show *why* (e.g. "3 shared practice areas · same state · 12 yrs senior").

### 2. Member-facing changes

**Dashboard (`app.dashboard.tsx`)** — replace the "Suggested matches" `directory.slice(0,3)` with top-3 scored matches. Show the score chip and top reason under each card.

**Discover (`app.discover.tsx`)**:
- Add a tab toggle: **Recommended for you** (sorted by score, role-filtered) / **Browse all**.
- Show match score + top 2 reasons on each card in Recommended view.
- Filters: practice area, state, mentor/mentee role, accepting mentees only.
- Mentees never see other mentees in Recommended; mentors never see other mentors.

### 3. Admin matching console

New route: `src/routes/app.org.matching.tsx` (admin only, gated by `isOrgAdmin`).

Layout:
- **Left pane**: list of mentees in the org with status — *Unmatched*, *Pending request*, *Active*. Search + filter by practice area / state.
- **Right pane**: when a mentee is selected, show a ranked list of candidate mentors using the same scoring engine, with score, reasons, current mentee load (count of active mentorships), and an **Assign** button.
- Clicking Assign inserts `mentorships` row with `status = 'active'`, `organization_id = currentOrgId`, mentor_id/mentee_id set — existing trigger `handle_mentorship_active` auto-creates the conversation and notifies both parties. Existing `app.admin.tsx` already does this; we reuse the pattern but scoped to current org and powered by the scoring engine instead of a flat dropdown.
- **Bulk mode**: checkbox-select multiple unmatched mentees → "Auto-assign top match for selected" (admin reviews preview list before confirming).

Add **Matching** to the org sidebar in `src/components/org-switcher.tsx`, admin-only. Add a QuickLink card on `app.org.index.tsx` ("3 unmatched mentees · review suggestions").

### 4. Insights tie-in

On `app.org.insights.tsx`, add a small **Matching health** card:
- Unmatched mentees count
- Mentors at/over capacity (active mentorships ≥ a soft cap of 3)
- Avg match score of active pairings (engine re-scored against current pairs)

This is the data point that justifies seat-based pricing — "your org has X unmatched mentees, every seat is being used productively."

### 5. Schema (no migration needed yet)

All inputs already exist on `profiles`. **Optional follow-up** (not in this plan, flag only): add `mentor_capacity int default 3` to `profiles` so each mentor can set their own cap instead of a hard-coded soft cap. Ask before adding.

### 6. No changes to

- RLS policies (existing org-scoped policies cover everything).
- Auth, billing, Stripe.
- The legacy `app.admin.tsx` super-admin page — leave as-is; the new console is org-scoped at `/app/org/matching`.

---

### Files

**Created**
- `src/lib/matching.ts` — scoring engine + types
- `src/routes/app.org.matching.tsx` — admin matching console

**Edited**
- `src/routes/app.dashboard.tsx` — use scored top-3
- `src/routes/app.discover.tsx` — Recommended/Browse tabs, filters, score chips
- `src/components/org-switcher.tsx` — add Matching nav (admin only)
- `src/routes/app.org.index.tsx` — unmatched-mentees QuickLink
- `src/routes/app.org.insights.tsx` — Matching health card

### Open question

Should mentors have a **capacity cap** (max active mentees) that they set themselves, or should we keep a soft org-wide default (e.g. 3) for v1 and revisit later?