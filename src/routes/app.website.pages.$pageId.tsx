import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getWebsitePage,
  updateWebsitePage,
  upsertSection,
  deleteSection,
  reorderSections,
  setPageStatus,
  saveSectionAsReusable,
} from "@/lib/website.functions";
import { regenerateSection, improvePageSeo } from "@/lib/website-ai.functions";
import {
  SECTION_LABELS,
  STATUS_LABELS,
  analyzePageSeo,
  type WebsitePage,
  type WebsiteSection,
  type WebsiteSectionType,
} from "@/lib/website";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";

export const Route = createFileRoute("/app/website/pages/$pageId")({
  component: PageEditorPage,
});

const SECTION_PALETTE: WebsiteSectionType[] = [
  "hero", "text", "image_text", "cta", "feature_grid", "stats", "testimonials",
  "faq", "video", "contact_form", "newsletter", "event_details", "sponsor_grid",
  "speaker_cards", "committee_cards", "resource_cards", "pricing_tiers",
  "member_directory", "timeline", "custom_html",
];

type Viewport = "desktop" | "tablet" | "mobile";
const VIEWPORT_WIDTHS: Record<Viewport, string> = {
  desktop: "100%",
  tablet: "820px",
  mobile: "390px",
};

function PageEditorPage() {
  const { pageId } = Route.useParams();
  const get = useServerFn(getWebsitePage);
  const upd = useServerFn(updateWebsitePage);
  const upsert = useServerFn(upsertSection);
  const del = useServerFn(deleteSection);
  const reorder = useServerFn(reorderSections);
  const setStatus = useServerFn(setPageStatus);
  const aiRewrite = useServerFn(regenerateSection);
  const aiSeo = useServerFn(improvePageSeo);
  const saveReusable = useServerFn(saveSectionAsReusable);
  const [page, setPage] = useState<WebsitePage | null>(null);
  const [sections, setSections] = useState<WebsiteSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [savingMeta, setSavingMeta] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  // Undo/redo stacks (capacity 30). A snapshot is { sections, page }.
  type Snapshot = { sections: WebsiteSection[]; page: WebsitePage };
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const skipSnapshot = useRef(false);
  const pushSnapshot = useCallback(() => {
    if (skipSnapshot.current || !page) return;
    undoStack.current.push({ sections: sections.map((s) => ({ ...s })), page: { ...page } });
    if (undoStack.current.length > 30) undoStack.current.shift();
    redoStack.current = [];
  }, [page, sections]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await get({ data: { pageId } });
      setPage(r.page as WebsitePage);
      setSections(r.sections as WebsiteSection[]);
      if (r.sections.length > 0 && !selectedId) setSelectedId((r.sections[0] as WebsiteSection).id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [get, pageId, selectedId]);

  useEffect(() => { void refresh(); }, [pageId]); // eslint-disable-line

  // Debounced meta autosave
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueMetaSave = (patch: Partial<WebsitePage>) => {
    if (!page) return;
    setPage({ ...page, ...patch } as WebsitePage);
    if (metaTimer.current) clearTimeout(metaTimer.current);
    metaTimer.current = setTimeout(async () => {
      setSavingMeta(true);
      try {
        await upd({ data: { pageId, patch: patch as any } });
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setSavingMeta(false);
      }
    }, 1200);
  };

  const selected = useMemo(
    () => sections.find((s) => s.id === selectedId) ?? null,
    [sections, selectedId],
  );

  const seo = useMemo(
    () => (page ? analyzePageSeo({ ...page, sections }) : { score: 0, issues: [] }),
    [page, sections],
  );

  if (loading || !page) {
    return <div className="p-8 text-sm text-muted-foreground">Loading editor…</div>;
  }

  const addSection = async (type: WebsiteSectionType) => {
    pushSnapshot();
    try {
      const r = await upsert({
        data: {
          pageId,
          organizationId: page.organization_id,
          section_type: type,
          display_order: sections.length,
          settings_json: {},
          content_json: {},
          visible: true,
          responsive_json: {},
        },
      });
      await refresh();
      setSelectedId(r.sectionId);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const removeSection = async (id: string) => {
    if (!confirm("Remove this section?")) return;
    pushSnapshot();
    await del({ data: { sectionId: id } });
    if (selectedId === id) setSelectedId(null);
    refresh();
  };

  const handleDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const from = sections.findIndex((s) => s.id === dragId);
    const to = sections.findIndex((s) => s.id === targetId);
    if (from < 0 || to < 0) { setDragId(null); return; }
    pushSnapshot();
    const reordered = [...sections];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setSections(reordered);
    setDragId(null);
    await reorder({ data: { pageId, orderedIds: reordered.map((s) => s.id) } });
  };

  const updateSelected = async (patch: Partial<WebsiteSection>, snapshot = true) => {
    if (!selected) return;
    if (snapshot) pushSnapshot();
    const merged = { ...selected, ...patch } as WebsiteSection;
    setSections(sections.map((s) => (s.id === selected.id ? merged : s)));
    await upsert({
      data: {
        sectionId: selected.id,
        pageId,
        organizationId: page.organization_id,
        section_type: merged.section_type,
        display_order: merged.display_order,
        settings_json: merged.settings_json,
        content_json: merged.content_json,
        visible: merged.visible,
        responsive_json: merged.responsive_json,
      },
    });
  };

  const restoreSnapshot = async (snap: Snapshot) => {
    skipSnapshot.current = true;
    setSections(snap.sections);
    setPage(snap.page);
    try {
      await upd({ data: { pageId, patch: {
        title: snap.page.title, slug: snap.page.slug,
        meta_title: snap.page.meta_title, meta_description: snap.page.meta_description,
      } as any } });
      await reorder({ data: { pageId, orderedIds: snap.sections.map((s) => s.id) } });
      for (const s of snap.sections) {
        await upsert({ data: {
          sectionId: s.id, pageId, organizationId: page.organization_id,
          section_type: s.section_type, display_order: s.display_order,
          settings_json: s.settings_json, content_json: s.content_json,
          visible: s.visible, responsive_json: s.responsive_json,
        }});
      }
    } finally { skipSnapshot.current = false; }
  };

  const undo = async () => {
    const snap = undoStack.current.pop();
    if (!snap || !page) return;
    redoStack.current.push({ sections: sections.map((s) => ({ ...s })), page: { ...page } });
    await restoreSnapshot(snap);
  };
  const redo = async () => {
    const snap = redoStack.current.pop();
    if (!snap || !page) return;
    undoStack.current.push({ sections: sections.map((s) => ({ ...s })), page: { ...page } });
    await restoreSnapshot(snap);
  };

  const publish = async (status: "draft" | "ready_for_review" | "published" | "archived") => {
    try {
      await setStatus({ data: { pageId, status } });
      toast.success(`Status: ${STATUS_LABELS[status]}`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="-m-6 flex h-[calc(100vh-9.5rem)] flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to={"/app/website/pages" as any} className="text-xs text-muted-foreground hover:text-foreground">
            ← All pages
          </Link>
          <input
            value={page.title}
            onChange={(e) => queueMetaSave({ title: e.target.value })}
            className="min-w-0 rounded border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-foreground hover:border-border focus:border-border focus:outline-none"
          />
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            {STATUS_LABELS[page.status]}
          </span>
          {savingMeta && <span className="text-xs text-muted-foreground">Saving…</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border bg-background p-0.5 text-xs">
            <button
              onClick={undo}
              disabled={undoStack.current.length === 0}
              title="Undo"
              className="rounded px-2 py-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
            >↶</button>
            <button
              onClick={redo}
              disabled={redoStack.current.length === 0}
              title="Redo"
              className="rounded px-2 py-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
            >↷</button>
          </div>
          <div className="flex rounded-lg border border-border bg-background p-0.5 text-xs">
            {(["desktop", "tablet", "mobile"] as Viewport[]).map((v) => (
              <button
                key={v}
                onClick={() => setViewport(v)}
                className={`rounded px-2 py-1 capitalize ${
                  viewport === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <Link
            to="/app/website/pages/$pageId/history"
            params={{ pageId }}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent"
          >
            History
          </Link>
          <button
            onClick={() => publish("draft")}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent"
          >
            Save draft
          </button>
          <button
            onClick={() => publish("ready_for_review")}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent"
          >
            Mark for review
          </button>
          <button
            onClick={() => publish("published")}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Publish
          </button>
        </div>
      </div>

      {/* 3-pane editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Sections */}
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-border bg-card">
          <div className="p-3">
            <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Sections</p>
            {sections.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sections yet. Add one below.</p>
            ) : (
              <ul className="space-y-1">
                {sections.map((s, i) => (
                  <li
                    key={s.id}
                    draggable
                    onDragStart={() => setDragId(s.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(s.id)}
                    onDragEnd={() => setDragId(null)}
                    className={dragId === s.id ? "opacity-50" : ""}
                  >
                    <button
                      onClick={() => setSelectedId(s.id)}
                      className={`group flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-xs ${
                        selectedId === s.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="cursor-grab text-muted-foreground/60">⋮⋮</span>
                        <span className="truncate">{i + 1}. {SECTION_LABELS[s.section_type]}</span>
                      </span>
                      <span
                        onClick={(e) => { e.stopPropagation(); removeSection(s.id); }}
                        className="rounded p-0.5 text-destructive opacity-0 hover:bg-background group-hover:opacity-100"
                      >×</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-border p-3">
            <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Add section</p>
            <div className="grid grid-cols-2 gap-1">
              {SECTION_PALETTE.map((t) => (
                <button
                  key={t}
                  onClick={() => addSection(t)}
                  className="rounded border border-border bg-background px-2 py-1.5 text-left text-[11px] text-muted-foreground hover:border-primary hover:text-foreground"
                >
                  + {SECTION_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Center: Preview */}
        <main className="flex-1 overflow-y-auto bg-muted/20 p-6">
          <div
            className="mx-auto rounded-xl border border-border bg-background shadow-sm transition-all"
            style={{ maxWidth: VIEWPORT_WIDTHS[viewport] }}
          >
            {sections.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                Empty page. Add sections from the left to start building.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {sections.map((s) => (
                  <SectionPreview
                    key={s.id}
                    section={s}
                    selected={selectedId === s.id}
                    onSelect={() => setSelectedId(s.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Right: Inspector + SEO */}
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-border bg-card">
          {selected ? (
            <div className="space-y-4 p-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Editing</p>
                <h3 className="text-sm font-semibold text-foreground">{SECTION_LABELS[selected.section_type]}</h3>
              </div>

              <AiRewriteButton
                onRun={async (instruction) => {
                  const r = await aiRewrite({ data: { sectionId: selected.id, instruction } });
                  await updateSelected({ content_json: r.content_json as Record<string, unknown> });
                  toast.success("Section rewritten");
                }}
              />

              <div className="flex flex-wrap gap-1">
                {[
                  { label: "Shorten", instr: "Make this 30% shorter while keeping the key message." },
                  { label: "Professional", instr: "Rewrite in a more professional, formal legal-industry tone." },
                  { label: "A11y", instr: "Improve accessibility: clearer headings, plain language, descriptive CTAs." },
                  { label: "Add FAQ", instr: "Append 3 short, helpful FAQ items relevant to this section." },
                  { label: "Add CTA", instr: "Add a compelling call-to-action sentence and button label." },
                ].map((q) => (
                  <button
                    key={q.label}
                    onClick={async () => {
                      try {
                        const r = await aiRewrite({ data: { sectionId: selected.id, instruction: q.instr } });
                        await updateSelected({ content_json: r.content_json as Record<string, unknown> });
                        toast.success(`Applied: ${q.label}`);
                      } catch (e) { toast.error((e as Error).message); }
                    }}
                    className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary hover:text-primary"
                  >
                    ✨ {q.label}
                  </button>
                ))}
              </div>

              <ContentFields section={selected} onChange={(content_json) => updateSelected({ content_json })} />

              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={selected.visible}
                    onChange={(e) => updateSelected({ visible: e.target.checked })}
                  />
                  Visible on page
                </label>
                <button
                  onClick={async () => {
                    const name = prompt("Name this saved section:", `${SECTION_LABELS[selected.section_type]} block`);
                    if (!name) return;
                    try {
                      await saveReusable({
                        data: {
                          organizationId: page.organization_id,
                          name,
                          section_type: selected.section_type,
                          settings_json: selected.settings_json,
                          content_json: selected.content_json,
                        },
                      });
                      toast.success("Saved to library");
                    } catch (e) { toast.error((e as Error).message); }
                  }}
                  className="text-[11px] text-primary hover:underline"
                >
                  Save as reusable
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 text-xs text-muted-foreground">Select a section to edit it.</div>
          )}

          <div className="border-t border-border p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Page SEO</p>
              <button
                onClick={async () => {
                  try {
                    const r = await aiSeo({ data: { pageId } });
                    queueMetaSave({ meta_title: r.meta_title, meta_description: r.meta_description });
                    toast.success("SEO improved");
                  } catch (e) { toast.error((e as Error).message); }
                }}
                className="text-[11px] text-primary hover:underline"
              >
                ✨ Improve with AI
              </button>
            </div>
            <div className="mt-2 space-y-2 text-xs">
              <label className="block">
                <span className="text-muted-foreground">Slug</span>
                <input
                  value={page.slug}
                  onChange={(e) => queueMetaSave({ slug: e.target.value })}
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-foreground"
                />
              </label>
              <label className="block">
                <span className="text-muted-foreground">Meta title</span>
                <input
                  value={page.meta_title ?? ""}
                  onChange={(e) => queueMetaSave({ meta_title: e.target.value })}
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-foreground"
                />
              </label>
              <label className="block">
                <span className="text-muted-foreground">Meta description</span>
                <textarea
                  value={page.meta_description ?? ""}
                  onChange={(e) => queueMetaSave({ meta_description: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-foreground"
                />
              </label>
            </div>
            <div className="mt-3 rounded-lg bg-muted/40 p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Quality score</span>
                <span className="text-sm font-semibold text-foreground">{seo.score}/100</span>
              </div>
              {seo.issues.length > 0 && (
                <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                  {seo.issues.map((i) => (
                    <li key={i.id}>• {i.message}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// Generic content editor — exposes `headline`, `subheadline`, `body`, `cta_label`, `image_url`, `html` if present
function ContentFields({
  section,
  onChange,
}: {
  section: WebsiteSection;
  onChange: (content_json: Record<string, unknown>) => void;
}) {
  const c = (section.content_json ?? {}) as Record<string, unknown>;
  const fields: Array<{ key: string; label: string; type: "text" | "textarea" }> = (() => {
    switch (section.section_type) {
      case "hero":
        return [
          { key: "headline", label: "Headline", type: "text" },
          { key: "subheadline", label: "Subheadline", type: "textarea" },
          { key: "cta_label", label: "Button label", type: "text" },
          { key: "image_url", label: "Background image URL", type: "text" },
        ];
      case "text":
        return [{ key: "body", label: "Body text", type: "textarea" }];
      case "image_text":
        return [
          { key: "headline", label: "Headline", type: "text" },
          { key: "body", label: "Body text", type: "textarea" },
          { key: "image_url", label: "Image URL", type: "text" },
        ];
      case "cta":
        return [
          { key: "headline", label: "Headline", type: "text" },
          { key: "subheadline", label: "Subheadline", type: "textarea" },
          { key: "cta_label", label: "Button label", type: "text" },
          { key: "cta_href", label: "Button link", type: "text" },
        ];
      case "video":
        return [
          { key: "headline", label: "Headline", type: "text" },
          { key: "video_url", label: "Video URL (YouTube/Vimeo)", type: "text" },
        ];
      case "custom_html":
        return [{ key: "html", label: "Custom HTML", type: "textarea" }];
      default:
        return [
          { key: "headline", label: "Headline", type: "text" },
          { key: "body", label: "Body text", type: "textarea" },
        ];
    }
  })();

  const update = (key: string, value: string) => onChange({ ...c, [key]: value });

  return (
    <div className="space-y-2 text-xs">
      {fields.map((f) => (
        <label key={f.key} className="block">
          <span className="text-muted-foreground">{f.label}</span>
          {f.type === "textarea" ? (
            <textarea
              value={(c[f.key] as string) ?? ""}
              onChange={(e) => update(f.key, e.target.value)}
              rows={3}
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-foreground"
            />
          ) : (
            <input
              value={(c[f.key] as string) ?? ""}
              onChange={(e) => update(f.key, e.target.value)}
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-foreground"
            />
          )}
        </label>
      ))}
    </div>
  );
}

function SectionPreview({
  section,
  selected,
  onSelect,
}: {
  section: WebsiteSection;
  selected: boolean;
  onSelect: () => void;
}) {
  const c = (section.content_json ?? {}) as Record<string, string>;
  const ring = selected ? "ring-2 ring-primary ring-inset" : "hover:ring-2 hover:ring-border hover:ring-inset";
  const base = `relative cursor-pointer ${ring} ${section.visible ? "" : "opacity-40"}`;

  switch (section.section_type) {
    case "hero":
      return (
        <div onClick={onSelect} className={`${base} bg-gradient-to-br from-primary/10 to-accent/10 px-8 py-16 text-center`}>
          <h1 className="text-3xl font-semibold text-foreground">{c.headline || "Hero headline"}</h1>
          <p className="mt-3 text-muted-foreground">{c.subheadline || "Subheadline goes here"}</p>
          {c.cta_label && (
            <button className="mt-5 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">
              {c.cta_label}
            </button>
          )}
        </div>
      );
    case "cta":
      return (
        <div onClick={onSelect} className={`${base} bg-primary/5 px-8 py-10 text-center`}>
          <h2 className="text-xl font-semibold text-foreground">{c.headline || "Call to action"}</h2>
          {c.subheadline && <p className="mt-2 text-sm text-muted-foreground">{c.subheadline}</p>}
          {c.cta_label && (
            <button className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              {c.cta_label}
            </button>
          )}
        </div>
      );
    case "text":
      return (
        <div onClick={onSelect} className={`${base} px-8 py-10`}>
          <p className="whitespace-pre-wrap text-sm text-foreground">{c.body || "Text block — click to edit."}</p>
        </div>
      );
    case "image_text":
      return (
        <div onClick={onSelect} className={`${base} grid gap-6 px-8 py-10 md:grid-cols-2`}>
          <div className="aspect-video rounded-lg bg-muted" style={c.image_url ? { backgroundImage: `url(${c.image_url})`, backgroundSize: "cover" } : undefined} />
          <div>
            <h3 className="text-lg font-semibold text-foreground">{c.headline || "Section headline"}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{c.body || "Body copy goes here."}</p>
          </div>
        </div>
      );
    case "custom_html":
      return (
        <div onClick={onSelect} className={`${base} px-8 py-10`}>
          <pre className="overflow-x-auto rounded bg-muted p-3 text-xs text-muted-foreground">{c.html || "<!-- custom html -->"}</pre>
        </div>
      );
    default:
      return (
        <div onClick={onSelect} className={`${base} px-8 py-10`}>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{SECTION_LABELS[section.section_type]}</p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">{c.headline || SECTION_LABELS[section.section_type]}</h3>
          {c.body && <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>}
        </div>
      );
  }
}

function AiRewriteButton({ onRun }: { onRun: (instruction: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-primary/50 bg-primary/5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10"
      >
        ✨ Rewrite with AI
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-2">
      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="e.g. Make it more concise and add urgency"
        rows={2}
        className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground"
      />
      <div className="flex justify-end gap-1">
        <button onClick={() => setOpen(false)} className="rounded px-2 py-1 text-[11px] text-muted-foreground">Cancel</button>
        <button
          disabled={busy || instruction.trim().length < 3}
          onClick={async () => {
            setBusy(true);
            try { await onRun(instruction.trim()); setOpen(false); setInstruction(""); }
            catch (e) { toast.error((e as Error).message); }
            finally { setBusy(false); }
          }}
          className="rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Rewriting…" : "Run"}
        </button>
      </div>
    </div>
  );
}
