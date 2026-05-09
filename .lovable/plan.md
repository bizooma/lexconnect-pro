## Goal

Make LexGuild installable on phones and desktops so it launches in a standalone, app-like window directly into the authenticated dashboard. **No service worker, no offline caching** — this avoids the preview-staleness problems Lovable warns about while still giving users the "Add to Home Screen" experience.

## What users will get

- "Install" / "Add to Home Screen" prompt available in Chrome, Edge, Safari (iOS), and Android.
- Installed icon on phone home screen / desktop launcher.
- Tapping the icon opens LexGuild in a standalone window (no browser chrome) directly at `/app/dashboard`.
- Unauthenticated users hitting `/app/dashboard` are still redirected to `/login` by the existing auth guard, so the launch experience is: open icon → login (first time) → dashboard, then open icon → dashboard thereafter.

## What will NOT change

- No service worker, no offline mode, no background sync.
- No new dependencies (`vite-plugin-pwa` is intentionally avoided).
- No changes to routing, auth, or any existing pages.
- Marketing site (`/`, `/login`, etc.) still works as a normal web page in browsers.

## Steps

1. **Generate app icons** — produce a square LexGuild icon (using the existing logo / brand colors from `src/components/logo.tsx` and `src/styles.css`) at 192×192, 512×512, and a 512×512 maskable variant. Save to `public/icons/`. Also add a 180×180 `apple-touch-icon.png` for iOS.

2. **Create `public/manifest.webmanifest`** with:
   - `name`: "LexGuild"
   - `short_name`: "LexGuild"
   - `start_url`: `/app/dashboard`
   - `scope`: `/`
   - `display`: `standalone`
   - `background_color` and `theme_color`: pulled from the existing design tokens (matches the `#1c2540` theme color already in `__root.tsx`)
   - `icons`: the three PNGs above (with `purpose: "any"` and `purpose: "maskable"` as appropriate)
   - `description`: matches the site meta description

3. **Wire the manifest into `src/routes/__root.tsx`** by adding to the existing `head().links` array:
   - `{ rel: "manifest", href: "/manifest.webmanifest" }`
   - `{ rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" }`
   - `{ rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/icon-192.png" }`
   - `{ rel: "icon", type: "image/png", sizes: "512x512", href: "/icons/icon-512.png" }`
   - And to `head().meta`:
     - `{ name: "apple-mobile-web-app-capable", content: "yes" }`
     - `{ name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" }`
     - `{ name: "apple-mobile-web-app-title", content: "LexGuild" }`
   - The existing `theme-color` meta stays as-is.

4. **Verify** by checking the built site serves `/manifest.webmanifest` and the icon files, and that DevTools → Application → Manifest shows no errors.

## Caveats to flag to the user

- **Manifest fields are pinned at install time.** Once someone installs LexGuild, changing `start_url`, `scope`, or `display` later won't update on their installed copy — only fresh installs see changes. So we should be confident `/app/dashboard` is the right launch target before shipping.
- **iOS install is manual** — Safari users tap Share → Add to Home Screen. Chrome/Edge/Android show an install prompt automatically once engagement criteria are met.
- **Install prompts only appear on the published site** (HTTPS), not in the editor preview iframe.
- If you later want offline support, that's a separate, larger change that adds a service worker and the complexity that comes with it.

## Files touched

- `public/manifest.webmanifest` (new)
- `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png` (new)
- `src/routes/__root.tsx` (add manifest + icon links and a few iOS meta tags to the existing `head()`)
