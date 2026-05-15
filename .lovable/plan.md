## Goal

Reorganize the app sidebar so the four product modules are visually distinct, with the Mentorship/Community module fully available to all members and the other three (Website Builder, Attorney Directory, CLE/LMS) shown as locked "add-ons" — except for the platform admin (`joe@bizooma.com`), who can access everything for testing.

## Module map

```text
CORE
  Mentorship & Community
    - Home          /app/dashboard
    - Discover      /app/discover
    - Community Q&A /app/qa
    - Messages      /app/messages
    - Meetings      /app/meetings
    - Activity      /app/activity

ADD-ONS
  Website Builder      /app/website         (locked unless add-on or admin)
  Attorney Directory   /app/directory       (locked, "Coming soon")
  CLE / LMS            /app/cle             (locked, "Coming soon")

PLATFORM
  Admin                /app/admin           (admins only)
```

## Sidebar changes (`src/routes/app.tsx`)

1. Replace the flat `NAV` list with two grouped sections rendered with subtle headers ("Core" / "Add-ons"):
   - Core group: existing 6 items, always enabled for signed-in members.
   - Add-ons group: 3 module entries with a small lock icon and muted styling when locked.
2. Add a per-item `enabled` flag computed from:
   - `isPlatformAdmin` (true if `user.email === "joe@bizooma.com"` OR `useIsAdmin()` returns true) → all unlocked.
   - Website Builder: enabled when `canEditWebsite` OR admin.
   - Directory & CLE: locked for everyone except admin.
3. Locked items render as a `<button>` (not `<Link>`), with `opacity-60`, lock icon, and a tooltip / toast on click: "This module isn't included in your plan yet — contact your admin."
4. Admin section stays separate at the bottom under a "Platform" label, only for admins.
5. Apply the same grouped structure to the mobile bottom nav: keep core 5 visible; collapse add-ons + admin into a "More" sheet that lists locked modules with the same lock affordance.

## Routes to scaffold (placeholders so links resolve)

- `src/routes/app.directory.tsx` — simple "Attorney Directory — Coming soon" page; admin sees a stub list.
- `src/routes/app.cle.tsx` — "CLE / LMS — Coming soon"; admin sees a stub.
- Both gate content with `useIsAdmin()` + email check; non-admins see the marketing/coming-soon view (so direct URL visits don't 404).

## Admin override helper

Add `src/hooks/use-is-platform-admin.ts`:

```ts
export function useIsPlatformAdmin() {
  const { user } = useAuth();
  const { isAdmin, checking } = useIsAdmin();
  return {
    isPlatformAdmin: isAdmin || user?.email === "joe@bizooma.com",
    checking,
  };
}
```

Used by sidebar + the two new routes. (The hardcoded email is just a convenience for testing; real access still flows through the `user_roles` admin role.)

## Out of scope

- No DB/RLS changes. Add-on entitlement modeling (per-org feature flags) is left for a follow-up; this PR only handles UI gating + admin override.
- No changes to existing Website Builder behavior beyond moving it under the "Add-ons" group.

## Files touched

- edit `src/routes/app.tsx` (grouped nav + lock affordance, mobile nav)
- new  `src/hooks/use-is-platform-admin.ts`
- new  `src/routes/app.directory.tsx`
- new  `src/routes/app.cle.tsx`
