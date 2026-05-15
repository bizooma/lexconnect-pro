## Website Builder — audit results

I went through the schema, server fns, public renderer, editor inspector, public route, sitemap/robots, custom domains, presence hook, and seeded data. Headline: **most plumbing is real, but several user-facing capabilities the prior progress notes called "complete" are partially fake or unreachable from the UI.** Below is what's actually working, what isn't, and what to fix.

---

### ✅ What is actually wired end-to-end

- DB migrations, enums, RLS, `can_edit_website` helper, brand-settings + global-templates seeds (13 templates present).
- Page CRUD, section upsert/reorder/delete, duplicate, status transitions, publish-history snapshot trigger.
- Brand settings get/update; saved-sections library; AI generations log.
- AI: `generatePageDraft`, `regenerateSection`, `improvePageSeo` all hit Lovable AI Gateway with structured tool calls and persist results.
- Public page route `/p/$orgSlug/$slug` (SSR + meta), brand-token CSS vars, og image via `ImageUploader`, `website-media` bucket.
- Page-view tracking + 30-day chart + top pages on dashboard (real inserts; verified table exists, 0 rows yet because no traffic).
- Custom domains: TXT verification via Cloudflare DoH, host resolution in `resolveCurrentHost`, host-aware sitemap + robots.txt.
- Real-time presence hook (`use-page-presence`) + avatar stack + per-section editor dot + "saved" broadcasts + refresh toast.
- 13 seeded global templates, drafts/published/sections/saved-sections/templates/AI/brand/domains/settings nav tabs all routed.

---

### ❌ Hard-coded / fake / broken functionality

**1. Newsletter & Contact-form sections do nothing on the public site** — *fake*  
`PublicSectionRenderer.tsx` lines 207, 221: both `<form onSubmit={(e) => e.preventDefault()}>` with no handler, no server fn, no destination. Visitors fill them out and the data is silently dropped. The seeded "Volunteer Signup", "Sponsor Spotlight", and contact templates rely on these.  
**Fix**: add a `website_form_submissions` table (org_id, page_id, section_id, kind, data jsonb, created_at, RLS readable by org admins/editors) + a `submitWebsiteForm` server fn (no auth — public) + a "Submissions" tab on the page editor or website overview. Wire both forms to call it.

**2. Scheduled publishing has no scheduler** — *the plan and follow-ups marked "schedule" complete, but it does nothing*  
`setPageStatus` accepts `status='scheduled'` and stores `scheduled_at`, the dashboard counts "Scheduled", and `published.tsx` shows a Scheduled tab — but **no UI lets a user pick a date and call it** (`grep schedulePage` returns zero hits in routes), and **nothing auto-promotes a scheduled page to `published` when the date arrives** (no pg_cron, no scheduled job, no edge function).  
**Fix**: (a) add a "Schedule…" button in the page-editor publish bar that opens a datetime dialog and calls `setPageStatus({ status: "scheduled", scheduledAt })`; (b) add a `pg_cron` job (every 5 min) that runs `UPDATE website_pages SET status='published', published_at=now() WHERE status='scheduled' AND scheduled_at <= now()` — the snapshot trigger will then fire.

**3. The section inspector only edits headline + body for most section types** — *fake editing*  
`ContentFields` in `app.website.pages.$pageId.tsx` only knows about hero, text, image_text, cta, video, custom_html. **Every "items"-based section (feature_grid, stats, faq, testimonials, pricing_tiers, event_details, sponsor_grid, speaker_cards, committee_cards, resource_cards, member_directory, timeline) falls through to a generic 2-field stub — you cannot add/edit/reorder the items through the UI.** Today the only way to get items into those sections is via the AI generator; once placed you can't edit them.  
**Fix**: extend `ContentFields` with array editors for each of those `items` shapes (title/body for feature_grid; value/label for stats; question/answer for faq; quote/author/role for testimonials; tier/price/features[] for pricing_tiers; date/title/desc for event_details/timeline; logo_url/name/href for sponsor_grid; etc.). One small `<ItemListEditor schema=... />` that handles add / remove / drag-reorder is enough.

**4. The public renderer renders ~half the section types as a generic 2-line block** — *fake output*  
`PublicSectionRenderer.tsx` switch covers hero/cta/text/image_text/feature_grid/stats/faq/testimonials/video/newsletter/contact_form/custom_html. **event_details, sponsor_grid, speaker_cards, member_directory, committee_cards, resource_cards, pricing_tiers, timeline all hit the `default:` branch and render only `headline + body`** — even though they're in the section palette and the seeded templates use them.  
**Fix**: implement real renderers for the eight missing types. They're all simple `items[]` layouts (logo grid, person card grid, pricing columns, vertical timeline, agenda list).

**5. The editor's center-pane preview also stops at 5 section types**  
Same issue as #4 inside the admin preview (`SectionPreview` switch handles hero/cta/text/image_text/custom_html). Authors can't see what the public site will render. After fixing #4, refactor `SectionPreview` to wrap `PublicSectionRenderer` so admin preview = public output (already used by the public route).

**6. `restorePublishSnapshot` can't actually restore a page** — *broken*  
The `website_pages_publish_snapshot` trigger captures page meta + `content_json` (an unused legacy column on `website_pages`), **not the `website_sections` rows that drive rendering**. So `restorePublishSnapshot` overwrites the page's title/slug/meta and a column nothing reads — the sections you saw at publish time don't come back.  
**Fix**: change the trigger to also include `(SELECT jsonb_agg(s ORDER BY display_order) FROM website_sections s WHERE s.page_id = NEW.id)` into `version_snapshot_json.sections`, then in `restorePublishSnapshot` delete the current sections and re-insert from the snapshot inside a transaction.

**7. Public-page header logo links to a non-existent route** — *broken link*  
`p.$orgSlug.$slug.tsx` line 93: `<a href={`/p/${organization.slug}`}>` — there is no `/p/$orgSlug` route, so clicking the logo on any public page 404s.  
**Fix**: link to `/p/${slug}/home` (or whichever page is the org's default — same logic `resolveCurrentHost` already uses).

**8. Custom-domain UI doesn't say it's a two-step setup** — *misleading, not strictly fake*  
The TXT-verification path works, but DNS still has to point at Lovable's hosting (`185.158.133.1`) and the domain has to be added in the Lovable platform's project settings for SSL termination. The current "How custom domains work" panel says "point a CNAME at the hosting provider in front of this app" without naming it, so users will get to "Verified" and still see no traffic.  
**Fix**: rewrite the help panel to call out the two systems explicitly (1) DNS at registrar → 185.158.133.1, (2) add domain in **Lovable Project Settings → Domains**, (3) then verify TXT here. Or, simpler: drop our custom-domain table and lean entirely on the platform's domain feature.

**9. "Content Editor & Reviewer roles — coming soon" copy is stale**  
`app.website.settings.tsx:86` still says "coming soon" but `can_edit_website` and the `content_editor` enum are live and used by RLS.  
**Fix**: replace with a one-liner "Content editors can build and edit pages but can't publish; only owners/admins can publish." (and gate the Publish button accordingly — currently any `canEditWebsite` user can publish).

**10. Two redundant nav entries**  
Sidebar has both **Drafts** and **Pages** — Drafts is `listWebsitePages({status:'draft'})`, exactly the same data Pages already filters. Same for **AI Builder** as a full route vs. the in-editor AI panel. Not broken, just clutter.  
**Fix**: drop Drafts (the Pages list already has a status filter), keep AI Builder as the new-page entry only, or merge it into `pages/new`.

---

### Suggested fix order (small to large)

1. **#7** broken header link — 2 lines.  
2. **#9** stale "coming soon" copy + gate Publish on owner/admin.  
3. **#1** Form submissions table + handler + admin viewer.  
4. **#4** + **#5** Implement remaining public renderers and fold the editor preview into them.  
5. **#3** Item-list editor in inspector for the eight items-based section types.  
6. **#2** Schedule UI + pg_cron promoter.  
7. **#6** Snapshot restore that includes section rows.  
8. **#8** Domains help text (or strategic decision to drop the table).  
9. **#10** Nav cleanup.

Steps 1–3 can land in a single follow-up; steps 4–5 are the biggest user-facing lift but unblock the templates (sponsor grid, speaker cards, pricing, timeline) the seed migration already inserts.

Want me to start implementing in this order, or do you want to scope it differently (e.g. drop section types you don't need so #3/#4/#5 shrink)?
