## Problem

Signup fails with `invalid input value for enum subscription_plan: "professional"`.

In `src/routes/signup.tsx`, the plan IDs are `starter`, `professional`, `enterprise`, but the DB enum `subscription_plan` only accepts `starter`, `pro`, `firm`. The code passes `plan.id` straight into the RPC with a misleading type cast, so "professional" and "enterprise" get rejected.

## Fix

In `src/routes/signup.tsx`, map the UI plan id to the DB enum before calling `create_organization_with_owner`:

- `starter` → `starter`
- `professional` → `pro`
- `enterprise` → `firm`

Also keep the existing checkout redirect using the UI plan id (`starter_monthly`, `professional_monthly`, etc.) since `VALID_PRICES` in `checkout.tsx` expects those keys — no change needed there.

That's a one-line mapping change in the `finish` handler. No DB migration, no other file touched.