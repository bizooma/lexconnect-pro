Two fixes, both scoped to close the audit gaps you flagged.

## 1. Push notifications — add opt-in UI

The full stack already exists (`src/lib/push-client.ts`, service worker at `/sw.js`, dispatcher at `src/routes/api/public/push.dispatch.ts`, VAPID keys, `push_subscriptions` table). The only gap: no UI calls `subscribeToPush()`.

**Add a "Push notifications" card to `src/routes/app.settings.tsx`:**
- On mount, check `isPushSupported()` and current subscription state via `getCurrentSubscription()`.
- Toggle button: "Enable push notifications" → calls `subscribeToPush(user.id)`; "Disable" → calls `unsubscribeFromPush(user.id)`.
- Handle the three environment states cleanly:
  - Unsupported browser → show disabled state with explanation.
  - Inside Lovable preview iframe (`isInIframe()`) → show hint to open the published site (push registration is blocked in iframes).
  - Permission previously denied → show instructions to re-enable in browser settings.
- Toast success/error using existing `sonner` pattern.
- No schema changes.

## 2. QA daily digest — build the missing job

Currently `qa_notification_prefs.mode = 'digest'` saves fine but nothing sends the email, so the option is labeled *(coming soon)*.

**Build the cron + sender:**

a. **New server route** `src/routes/api/public/hooks/qa-digest.ts` (POST, apikey-authenticated):
   - Load all users where `qa_notification_prefs.mode = 'digest'`, grouped by `organization_id`.
   - For each user, query `qa_posts` + `qa_replies` created in the last 24h in their org, excluding their own activity, respecting `qa_follows` when the user only wants followed threads.
   - Render an email using a new template `src/lib/email-templates/qa-digest.tsx` (matches the existing template style — see `contact-notification.tsx`).
   - Send via the existing email pipeline (enqueue into `pgmq` transactional queue using the same pattern the contact form uses) so unsubscribe tokens and suppression list are respected.
   - Skip users with zero new activity (no empty digests).
   - Return `{ sent, skipped }` JSON.

b. **Register the template** in `src/lib/email-templates/registry.ts`.

c. **Schedule via pg_cron** (supabase insert tool, not migration): daily at 9am user-org-agnostic UTC, calling the new route with the anon key in an `apikey` header. Empty body.

d. **Flip the label** in `src/routes/app.qa.notifications.tsx`: remove "(coming soon)" from the Daily digest option's description.

### Not included
- Per-user digest send-time (fixed 9am UTC for v1).
- Weekly digest option.
- Push-notification prefs UI beyond on/off (per-kind mute toggles stay backend-only for now).

### Technical notes
- Push toggle is purely frontend — reuses all existing `push-client.ts` helpers.
- Digest route uses `/api/public/` prefix + `apikey` header (canonical cron auth), no new secrets required.
- Email delivery goes through the existing pgmq queue, so DKIM/domain/suppression already work.
- No RLS changes; digest route uses `supabaseAdmin` loaded inside the handler after `apikey` verification.
