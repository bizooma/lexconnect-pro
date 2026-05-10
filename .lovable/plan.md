# LexGuild Resources — Phase 1 Plan

Lightweight, mentorship-focused resource sharing. Three surfaces: chat attachments, meeting attachments, and an org Resource Library. Branded as "Resources" throughout — never "files" or "documents."

## Database

New private storage bucket: `resources` (RLS-gated, signed URLs only).

New tables (all RLS-enforced, scoped to `organization_id`):

- `resources` — id, organization_id, uploaded_by_user_id, title, description, storage_path, file_name, file_type, file_size, category (enum), visibility (`organization` | `conversation` | `meeting`), is_featured (bool), created_at
- `message_resources` — message_id, resource_id (links chat attachment to a resource row)
- `meeting_resources` — meeting_id, resource_id

Category enum: `mentorship_guide`, `cle`, `template`, `checklist`, `professional_development`, `meeting`, `other`.

RLS rules:
- SELECT: `is_org_member(organization_id, auth.uid())` AND (visibility=`organization` OR uploader OR participant in linked conversation/meeting)
- INSERT org-library (`visibility=organization`): only `is_org_admin`
- INSERT conversation/meeting attachments: any org member who is a participant of the linked conversation/meeting
- DELETE/UPDATE (feature toggle): org admins, or uploader for their own message/meeting attachments
- Storage policies on bucket mirror the above; objects keyed `{organization_id}/{resource_id}.{ext}`

Server-side validation trigger enforces:
- file_size ≤ 25MB
- file_type ∈ allowed MIME list (PDF, DOCX, XLSX, PPTX, JPG, PNG)

## Server functions (`src/lib/resources.functions.ts`)

- `createResource({ orgId, title, description, category, visibility, fileName, fileType, fileSize })` → returns `{ resourceId, uploadUrl }` (signed upload URL)
- `attachResourceToMessage({ messageId, resourceId })`
- `attachResourceToMeeting({ meetingId, resourceId })`
- `getResourceDownloadUrl(resourceId)` → short-lived signed URL
- `listOrgResources({ orgId, category?, search?, sort? })`
- `toggleFeatured(resourceId)` (admin only)
- `deleteResource(resourceId)` (admin or uploader)

All use `requireSupabaseAuth`; RLS does the gating.

## UI

### Shared components (`src/components/resources/`)
- `ResourceCard` — file-type icon, title, size, type badge, uploader+date, download button. Navy/gold/ivory styling, soft shadow.
- `ResourceUploader` — drag/drop (desktop), file/camera input (mobile), progress bar, 25MB+type validation, subtle "Do not upload confidential or privileged client information" notice.
- `ResourcePicker` — pick from existing org-library OR upload new (used inside meeting/message composers).
- `FileTypeIcon` — branded icons per type.

### Messages (`src/routes/app.messages.$id.tsx`)
- Add paperclip button in composer → opens uploader.
- Inline `ResourceCard` rendered for messages with linked `message_resources`.
- PDF inline preview (object/iframe) when type is PDF and on desktop.
- Drag-and-drop on the thread container.

### Meetings (`src/routes/app.meetings.tsx`)
- Add "Attach resources" section to the schedule dialog (uses `ResourcePicker`).
- Meeting cards display attached resource chips with download.

### Org Resource Library (new route `src/routes/app.org.resources.tsx`)
- Sections: Featured, Recently Added, Mentorship Guides, CLE Materials, Templates & Checklists.
- Search input + category filter chips + sort (recent / name).
- Admins see "Upload resource" CTA + per-card menu (Feature, Delete).
- Members see read-only library with download buttons.
- Subtle confidentiality notice at top.
- Add nav link in `src/routes/app.org.index.tsx` and the org sub-nav.

### Mobile UX
- Bottom-sheet uploader on mobile, full-width cards, large tap targets, sticky search.

## Analytics

Wrap a `trackEvent(name, params)` helper around `window.gtag` and fire:
- `resource_uploaded` (category, file_type, size, visibility)
- `resource_downloaded` (resource_id, source: library|message|meeting)
- `library_resource_viewed`
- `meeting_resource_attached`

## Out of scope (explicitly NOT building)
Folders, version history, collaborative editing, tagging, advanced search, previews beyond PDF, comments on resources, admin bulk tools, notifications for new resources.

## Technical notes
- Uploads go directly browser → Supabase Storage via signed upload URL returned from server fn (keeps Worker memory low, no 25MB body through edge).
- All downloads via 1-hour signed URLs minted on demand — bucket stays private.
- Reuse existing `useCurrentOrg` for org scoping and admin gating (`isOrgAdmin`).
- Branding: navy headers, gold accent on Featured badges, ivory card surfaces, existing `shadow-card` / `shadow-elegant` tokens.
