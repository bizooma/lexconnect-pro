
## Website Builder — Admin Module Plan

A new admin-only module inside the existing LexGuild dashboard. Strictly multi-tenant via the existing `organizations` + `organization_members` model. The current public site at `/` and the mentorship UX stay untouched. Published pages are stored but **not** rendered on the public frontend in this phase — preview is admin-only.

---

### 1. Scope guardrails

- No changes to `src/routes/index.tsx`, `__root.tsx` marketing chrome, or any non-`/app/*` route.
- No new public routes. No custom-domain wiring. No public page rendering.
- Sidebar entry added only inside `src/routes/app.tsx` and only visible when `useCurrentOrg().isOrgAdmin` is true (or platform admin via `useIsAdmin`).
- All access gated by RLS using existing `is_org_member` / `is_org_admin` helpers.

---

### 2. Database (single migration)

New enums:
- `website_page_status`: `draft`, `ready_for_review`, `scheduled`, `published`, `archived`
- `website_page_type`: `home`, `landing`, `event`, `sponsor`, `committee`, `mentorship`, `cle`, `resource`, `blog`, `legal_aid`, `custom`
- `website_section_type`: hero, text, image_text, cta, event_details, sponsor_grid, speaker_cards, member_directory, committee_cards, resource_cards, faq, testimonials, contact_form, newsletter, video, pricing_tiers, feature_grid, stats, timeline, custom_html
- `website_ai_generation_kind`: `page_draft`, `section_rewrite`, `copy_rewrite`, `seo`, `accessibility`, `faq`, `cta`

New tables (every row carries `organization_id`, RLS scoped via `is_org_member` / `is_org_admin`):

| Table | Key columns |
|---|---|
| `website_pages` | org_id, title, slug (unique per org), page_type, status, meta_title, meta_description, og_title, og_description, og_image, content_json (jsonb section tree), content_html (cached render, nullable), created_by, updated_by, published_at, scheduled_at, archived_at |
| `website_sections` | page_id, org_id, section_type, display_order, settings_json, content_json, visible bool, responsive_json (desktop/tablet/mobile overrides) |
| `website_templates` | org_id (nullable for global seeded templates), name, page_type, preview_image, default_sections_json, suggested_copy_json, is_global bool |
| `website_brand_settings` | org_id (unique), logo_url, favicon_url, primary/secondary/accent colors, heading_font, body_font, button_style, page_width, border_radius, seo_title_suffix, social_links jsonb, contact_info jsonb, footer_text |
| `website_saved_sections` | org_id, name, section_type, settings_json, content_json, created_by |
| `website_ai_generations` | org_id, user_id, prompt, kind, generated_content_json, model, tokens_used, created_at |
| `website_publish_history` | page_id, org_id, published_by, version_snapshot_json, published_at, action (publish/unpublish/schedule) |

Indexes: `(org_id, status, updated_at desc)`, `(org_id, page_type)`, unique `(org_id, slug)`.

Triggers:
- `updated_at` maintenance on all mutable tables.
- `website_pages` insert/update → auto-snapshot into `website_publish_history` on transition to `published`.
- Auto-seed `website_brand_settings` row on org creation; auto-seed global templates flag on first read (templates seeded by migration loop with `is_global = true`).

RLS:
- SELECT: `is_org_member(org_id, auth.uid())` OR (`is_global = true` for templates).
- INSERT/UPDATE/DELETE: `is_org_admin(org_id, auth.uid())` plus `org_can_write(org_id)` for writes. Content editors covered by `is_org_admin` for v1 — finer-grained roles deferred (see §7).

Seed migration loops over existing orgs to insert one `website_brand_settings` row each, plus inserts ~13 global templates listed in §5.

---

### 3. Routes (TanStack Start, all under `/app/website/`)

```
src/routes/app.website.tsx                layout + tab nav, gated by isOrgAdmin
src/routes/app.website.index.tsx          dashboard overview (cards + recent activity)
src/routes/app.website.pages.tsx          page list (filter by status/type)
src/routes/app.website.pages.$pageId.tsx  visual editor (sections + right-side settings)
src/routes/app.website.pages.new.tsx      create flow (blank / template / AI)
src/routes/app.website.templates.tsx      template library + preview
src/routes/app.website.sections.tsx       saved/reusable sections manager
src/routes/app.website.brand.tsx          brand settings form
src/routes/app.website.ai.tsx             AI builder full-page panel
src/routes/app.website.drafts.tsx         drafts queue
src/routes/app.website.published.tsx      published + scheduled list
src/routes/app.website.settings.tsx       module settings (seo defaults, etc.)
```

Sidebar in `src/routes/app.tsx`: insert "Website Builder" (Globe icon) under the admin-visible group, between "Organization" and "Admin". Hidden entirely when not org admin.

---

### 4. Server functions (`src/lib/website.functions.ts` + `website-ai.functions.ts`)

All use `requireSupabaseAuth` so RLS applies as the user. Org id pulled from authenticated context — never trusted from client. Zod-validated input on every call.

- `listPages`, `getPage`, `createPage`, `updatePage`, `duplicatePage`, `archivePage`, `deletePage`
- `publishPage`, `unpublishPage`, `schedulePage` (writes to `website_publish_history`)
- `listSections`, `upsertSection`, `reorderSections`, `deleteSection`, `duplicateSection`
- `listTemplates` (global + org), `useTemplate(templateId, targetTitle)` → creates draft page
- `listSavedSections`, `saveSectionAsReusable`, `insertSavedSection`
- `getBrandSettings`, `updateBrandSettings`
- AI: `generatePageDraft(prompt)`, `regenerateSection(sectionId, instruction)`, `rewriteCopy`, `improveSeo`, `improveAccessibility`, `addFaq`, `addCta` — all call Lovable AI Gateway (`google/gemini-2.5-flash` default; `gpt-5-mini` for SEO/accessibility analysis), persist to `website_ai_generations`, return draft JSON. Never auto-publish.

---

### 5. Visual builder components (`src/components/website/`)

- `page-editor.tsx` — three-pane layout: section list (left), canvas preview (center), inspector (right).
- `section-renderer.tsx` — switch on `section_type` → renders preview using brand tokens.
- `section-inspector.tsx` — type-specific form (settings_json + content_json) using existing shadcn Form primitives.
- `section-palette.tsx` — drag-to-add new section.
- `viewport-toggle.tsx` — desktop / tablet / mobile preview frame (CSS width clamp, no iframe).
- `ai-prompt-panel.tsx` — prompt box + quick-action buttons (Generate / Rewrite / Shorten / Make Professional / Improve SEO / Improve A11y / Add FAQ / Add CTA).
- `seo-panel.tsx` — title/desc/og/slug + live quality score (heading hierarchy, alt text, contrast against brand colors, missing CTA, mobile warnings).
- `template-card.tsx`, `page-status-badge.tsx`, `publish-dialog.tsx` (publish now / schedule), `brand-settings-form.tsx`.
- Drag-and-drop via `@dnd-kit/core` + `@dnd-kit/sortable` (already common; add as new dep). Autosave via debounced `updatePage` (1.5s). Undo/redo via in-memory stack on the editor (last 30 states) — not persisted.

Templates seeded (§2):
Bar Association Homepage, Annual Convention Landing, CLE Event, Sponsorship Opportunities, Mentorship Program, Committee, Member Benefits, Join/Renew Membership, Legal Aid Resource, Judicial Reception, Newsletter Article, Sponsor Spotlight, Volunteer Signup.

---

### 6. AI builder behavior

- Single `generatePageDraft` call returns `{ title, slug, page_type, meta_title, meta_description, sections: [...] }` — inserted as **draft** page. User reviews in editor before any publish.
- Per-section "Regenerate" / "Rewrite" actions operate on a single section's `content_json` and return a replacement object the user must accept.
- All AI outputs logged to `website_ai_generations` for audit + future analytics.
- Uses Lovable AI Gateway — no extra API keys required.

---

### 7. Permissions (v1)

- Platform admin (`useIsAdmin`) and org owner/admin (`isOrgAdmin`): full access.
- Members / mentors / mentees: module hidden, server functions reject via RLS.
- "Content Editor" / "Reviewer" sub-roles: deferred — noted in module settings as "coming soon" so the schema doesn't need a new role enum yet. When added later, gate writes on a new `org_member_role` value without touching this module's RLS predicates (just swap `is_org_admin` for a `can_edit_website` helper).

---

### 8. Dashboard overview (`app.website.index.tsx`)

Cards: Total Pages, Drafts, Published, Scheduled, Recently Updated.
Recent activity feed: last 20 entries from `website_publish_history` + AI generations + page edits (joined client-side).
Primary CTAs: Create New Page · Use Template · Generate with AI.

---

### 9. Out of scope (this phase)

- Public rendering of published pages (no `/p/:slug` route, no custom domains).
- Public sitemap/robots changes.
- Granular Editor/Reviewer roles (schema-ready, UI deferred).
- Real-time multi-user editing.
- Image upload for OG/hero (uses existing `resources` bucket via `resource-uploader` — reuse only, no new bucket).
- Content version diffing UI (snapshots stored, viewer deferred).

---

### 10. Delivery order

1. **Migration**: enums, tables, RLS, triggers, brand-settings seed loop, global templates seed.
2. **Server functions + types**: `website.functions.ts`, `website-ai.functions.ts`, Zod schemas.
3. **Routes + list/dashboard/brand/template/saved-sections screens** (no editor yet).
4. **Visual editor + inspector + viewport preview + autosave**.
5. **AI builder panel + per-section AI actions + SEO/a11y panel**.
6. **Publish workflow + schedule + history**.

Each step ships behind the admin-only sidebar entry, so nothing is user-visible to non-admins until §3+ lands. The public site is never modified.
