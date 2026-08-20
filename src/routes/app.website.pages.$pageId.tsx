import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { regenerateSection, improvePageSeo, generatePageDraft, generateFromTemplate, getAiQuota, revisePage, revertPageRevision } from "@/lib/website-ai.functions";
import { readAiInputs, stashAiInputs, type AiRegenStash } from "@/lib/ai-regen-stash";
import {
  SECTION_LABELS,
  STATUS_LABELS,
  analyzePageSeo,
  type WebsitePage,
  type WebsiteSection,
  type WebsiteSectionType,
} from "@/lib/website";
import { ImageUploader } from "@/components/website/ImageUploader";
import { StarterPhotosGrid } from "@/components/website/StarterPhotosGrid";
import { ItemListEditor, getItemSchema } from "@/components/website/ItemListEditor";

import { PublicSectionRenderer } from "@/components/website/PublicSectionRenderer";
import { usePagePresence, type PresencePeer } from "@/hooks/use-page-presence";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useIsAdmin } from "@/hooks/use-is-admin";
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
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState<string>("");
  const inspectorRef = useRef<HTMLElement | null>(null);
  const [photoNudgeDismissed, setPhotoNudgeDismissed] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setPhotoNudgeDismissed(window.localStorage.getItem(`lexguild.photoNudge.${pageId}`) === "1");
  }, [pageId]);
  const dismissPhotoNudge = useCallback(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(`lexguild.photoNudge.${pageId}`, "1");
    setPhotoNudgeDismissed(true);
  }, [pageId]);
  const focusImageUploader = useCallback(() => {
    requestAnimationFrame(() => {
      inspectorRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, []);


  const { user } = useAuth();
  const { isOrgAdmin, currentOrgId } = useCurrentOrg();
  const { isAdmin: isPlatformAdmin } = useIsAdmin();
  const canPublish = isOrgAdmin || isPlatformAdmin;

  // "Try another version" — re-runs the original AI generation into a NEW draft page
  const navigate = useNavigate();
  const aiFreeform = useServerFn(generatePageDraft);
  const aiTemplate = useServerFn(generateFromTemplate);
  const quotaFn = useServerFn(getAiQuota);
  const [regenInputs, setRegenInputs] = useState<AiRegenStash | null>(null);
  const [regenBusy, setRegenBusy] = useState(false);

  type AiQuota = {
    used: number;
    limit: number;
    remaining: number;
    purchased: number;
    period: string;
    resetsOn: string;
  };
  const [aiQuota, setAiQuota] = useState<AiQuota | null>(null);

  useEffect(() => {
    setRegenInputs(readAiInputs(pageId));
  }, [pageId]);

  useEffect(() => {
    if (!currentOrgId) return;
    quotaFn({ data: { organizationId: currentOrgId } })
      .then((r) =>
        setAiQuota({
          used: r.used,
          limit: r.limit,
          remaining: r.remaining,
          purchased: r.purchased,
          period: r.period,
          resetsOn: r.resetsOn,
        }),
      )
      .catch(() => {});
  }, [currentOrgId, quotaFn]);


  // Page-level AI conversation bar
  const reviseFn = useServerFn(revisePage);
  const revertFn = useServerFn(revertPageRevision);
  const [instruction, setInstruction] = useState("");
  const [reviseBusy, setReviseBusy] = useState(false);
  const [reviseError, setReviseError] = useState<string | null>(null);
  const [lastRevisionId, setLastRevisionId] = useState<string | null>(null);

  const runRevision = useCallback(async () => {
    const text = instruction.trim();
    if (text.length < 5 || reviseBusy) return;
    setReviseBusy(true);
    setReviseError(null);
    try {
      const r = await reviseFn({ data: { pageId, instruction: text } });
      setAiQuota((q) => (q ? { ...q, remaining: r.remaining, limit: r.limit } : null));
      setLastRevisionId(r.revisionId);

      setInstruction("");
      toast.success("Page updated by AI.");
      await refreshRef.current();
    } catch (e) {
      setReviseError(
        e instanceof Error && e.message ? e.message : "The AI couldn't apply that change.",
      );
    } finally {
      setReviseBusy(false);
    }
  }, [instruction, reviseBusy, reviseFn, pageId]);

  const revertRevision = useCallback(async () => {
    if (!lastRevisionId) return;
    try {
      await revertFn({ data: { revisionId: lastRevisionId } });
      setLastRevisionId(null);
      toast.success("Reverted the AI change.");
      await refreshRef.current();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Couldn't revert.");
    }
  }, [lastRevisionId, revertFn]);

  const tryAnotherVersion = useCallback(async () => {
    if (!regenInputs || !currentOrgId || regenBusy) return;
    setRegenBusy(true);
    try {
      const r =
        regenInputs.mode === "freeform"
          ? await aiFreeform({ data: { organizationId: currentOrgId, prompt: regenInputs.prompt } })
          : await aiTemplate({
              data: {
                organizationId: currentOrgId,
                templateId: regenInputs.templateId,
                answers: regenInputs.answers,
              },
            });
      setAiQuota((q) => (q ? { ...q, remaining: r.remaining, limit: r.limit } : null));
      if (!r?.pageId) {

        toast.error("Generation didn't produce a page — please try again.");
        return;
      }
      stashAiInputs(r.pageId, regenInputs);
      toast.success("New draft created — your previous draft is untouched.");
      navigate({ to: "/app/website/pages/$pageId", params: { pageId: r.pageId } });
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Generation failed — please try again.");
    } finally {
      setRegenBusy(false);
    }
  }, [regenInputs, currentOrgId, regenBusy, aiFreeform, aiTemplate, navigate]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const { peers, broadcastSaved } = usePagePresence({
    pageId,
    userId: user?.id ?? null,
    name: (user?.user_metadata?.full_name as string) || user?.email || "Editor",
    avatarUrl: (user?.user_metadata?.avatar_url as string) ?? null,
    selectedSectionId: selectedId,
    onRemoteSave: (by) => {
      const peer = peers.find((p) => p.userId === by);
      toast.message(`${peer?.name ?? "A teammate"} updated this page`, {
        action: { label: "Refresh", onClick: () => void refreshRef.current() },
      });
    },
  });

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

  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
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
        broadcastSaved();
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

  const setSectionImageUrl = useCallback(async (sectionId: string, url: string) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section || !page) return;
    pushSnapshot();
    const merged = {
      ...section,
      content_json: { ...(section.content_json ?? {}), image_url: url },
    } as WebsiteSection;
    setSections(sections.map((s) => (s.id === sectionId ? merged : s)));
    setSelectedId(sectionId);
    await upsert({
      data: {
        sectionId,
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
    broadcastSaved();
  }, [sections, page, pageId, upsert, pushSnapshot, broadcastSaved]);

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
      broadcastSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const removeSection = async (id: string) => {
    if (!confirm("Remove this section?")) return;
    pushSnapshot();
    await del({ data: { sectionId: id } });
    if (selectedId === id) setSelectedId(null);
    broadcastSaved();
    refresh();
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((s) => s.id === active.id);
    const to = sections.findIndex((s) => s.id === over.id);
    if (from < 0 || to < 0) return;
    pushSnapshot();
    const reordered = arrayMove(sections, from, to);
    setSections(reordered);
    await reorder({ data: { pageId, orderedIds: reordered.map((s) => s.id) } });
    broadcastSaved();
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
    broadcastSaved();
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

  const schedule = async () => {
    if (!scheduleAt) { toast.error("Pick a date and time"); return; }
    const iso = new Date(scheduleAt).toISOString();
    if (Number.isNaN(Date.parse(iso))) { toast.error("Invalid date"); return; }
    try {
      await setStatus({ data: { pageId, status: "scheduled", scheduledAt: iso } });
      toast.success(`Scheduled for ${new Date(iso).toLocaleString()}`);
      setScheduleOpen(false);
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
          <PresenceStack peers={peers} />
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
          {regenInputs && (
            <button
              onClick={tryAnotherVersion}
              disabled={regenBusy || (aiQuota !== null && aiQuota.remaining <= 0)}
              title={
                aiQuota !== null && aiQuota.remaining <= 0
                  ? "You've used all your AI generations"
                  : "Re-run the same AI generation into a new draft page (uses one generation)"
              }
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent disabled:opacity-50"
            >
              {regenBusy
                ? "Generating…"
                : `✨ Try another version${aiQuota ? ` (${aiQuota.remaining} left${aiQuota.purchased ? ` + ${aiQuota.purchased} purchased` : ""})` : ""}`}
            </button>
          )}

          {lastRevisionId && (
            <button
              onClick={revertRevision}
              title="Restore the page to how it was before the last AI change"
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent"
            >
              ↩ Revert AI change
            </button>
          )}
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
          <Link
            to="/website-preview/$pageId"
            params={{ pageId }}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent"
          >
            Preview
          </Link>
          <button
            onClick={() => publish("ready_for_review")}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent"
          >
            Mark for review
          </button>
          {canPublish && (
            <>
              <button
                onClick={() => setScheduleOpen((v) => !v)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent"
              >
                Schedule…
              </button>
              <button
                onClick={() => publish("published")}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                Publish
              </button>
            </>
          )}
          {!canPublish && (
            <span
              title="Only owners and admins can publish or schedule"
              className="rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground"
            >
              Publish (admin only)
            </span>
          )}
        </div>
      </div>

      {scheduleOpen && canPublish && (
        <div className="border-b border-border bg-muted/30 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-medium text-foreground">Publish at:</label>
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
            />
            <button
              onClick={schedule}
              disabled={!scheduleAt}
              className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              Schedule
            </button>
            <button onClick={() => setScheduleOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <span className="text-[11px] text-muted-foreground">
              The page will auto-publish within 5 minutes of this time.
            </span>
          </div>
        </div>
      )}

      {/* 3-pane editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Sections */}
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-border bg-card">
          <div className="p-3">
            <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Sections</p>
            {sections.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sections yet. Add one below.</p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-1">
                    {sections.map((s, i) => (
                      <SortableSectionItem
                        key={s.id}
                        id={s.id}
                        index={i}
                        label={SECTION_LABELS[s.section_type]}
                        selected={selectedId === s.id}
                        onSelect={() => setSelectedId(s.id)}
                        onRemove={() => removeSection(s.id)}
                        editor={peers.find((p) => p.selectedSectionId === s.id) ?? null}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
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
            <div className="mt-3 rounded border border-dashed border-border p-2 text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Sponsor directory:</span> link any nav item or CTA to{" "}
              <code className="rounded bg-muted px-1">/sponsors</code> on your published site.
            </div>
          </div>

        </aside>

        {/* Center: Preview */}
        <main className="flex-1 overflow-y-auto bg-muted/20 p-6">
          {!photoNudgeDismissed &&
            page.status === "draft" &&
            !page.published_at &&
            sections.some((s) => sectionNeedsImage(s)) && (
              <div
                className="mx-auto mb-4 flex items-center justify-between gap-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3"
                style={{ maxWidth: VIEWPORT_WIDTHS[viewport] }}
              >
                <p className="text-xs text-foreground">
                  <span className="font-medium">Your draft is ready</span> — add photos to make it yours.
                </p>
                <button
                  onClick={dismissPhotoNudge}
                  className="shrink-0 rounded px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Dismiss
                </button>
              </div>
            )}
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
                    onAddImage={focusImageUploader}
                    onPickStarterPhoto={(url) => void setSectionImageUrl(s.id, url)}
                  />

                ))}
              </div>
            )}
          </div>
          <div className="sticky bottom-0 z-10 -mx-6 mt-6 border-t border-border bg-card/95 px-6 py-3 backdrop-blur">
            <div className="mx-auto flex max-w-3xl flex-col gap-1">
              <div className="flex items-center gap-2">
                <input
                  value={instruction}
                  onChange={(e) => { setInstruction(e.target.value); setReviseError(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void runRevision(); } }}
                  disabled={reviseBusy}
                  placeholder="Tell the AI what to change on this page…"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-60"
                />
                <button
                  onClick={() => void runRevision()}
                  disabled={reviseBusy || instruction.trim().length < 5 || (aiQuota !== null && aiQuota.remaining <= 0)}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {reviseBusy ? "Working…" : "Send"}
                </button>
              </div>
              {reviseError ? (
                <p className="text-[11px] text-destructive">{reviseError}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Try “add an FAQ about parking after the schedule” or “move sponsors above the speakers”.
                  {aiQuota
                    ? ` · ${aiQuota.remaining} of ${aiQuota.limit} AI runs left this month${aiQuota.purchased ? ` + ${aiQuota.purchased} purchased` : ""}`
                    : ""}
                </p>
              )}

            </div>
          </div>
        </main>

        {/* Right: Inspector + SEO */}
        <aside ref={inspectorRef} className="w-80 shrink-0 overflow-y-auto border-l border-border bg-card">

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
                      } catch (e) { toast.error(e instanceof Error && e.message ? e.message : "Generation failed — please try again."); }
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
            <div className="mt-3 space-y-2 rounded-lg border border-border p-2">
              <label className="flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={page.show_in_nav}
                  onChange={(e) => queueMetaSave({ show_in_nav: e.target.checked })}
                />
                Show in navigation
              </label>
              <label className="block text-xs">
                <span className="text-muted-foreground">Nav order</span>
                <input
                  type="number"
                  min={0}
                  max={9999}
                  value={page.nav_order}
                  onChange={(e) => queueMetaSave({ nav_order: Math.max(0, Math.min(9999, Number(e.target.value) || 0)) })}
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-foreground"
                />
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Lower numbers appear first. Only published pages show in the public menu.
                </span>
              </label>
            </div>
            <div className="mt-3">
              <ImageUploader
                organizationId={page.organization_id}
                value={page.og_image}
                onChange={(url) => queueMetaSave({ og_image: url })}
                label="Open Graph image"
                hint="1200×630 recommended"
                aspect="wide"
              />
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
      {fields.map((f) => {
        if (f.key === "image_url") {
          return (
            <ImageUploader
              key={f.key}
              organizationId={section.organization_id}
              value={(c[f.key] as string) ?? ""}
              onChange={(url) => update(f.key, url ?? "")}
              label={f.label}
              aspect={section.section_type === "hero" ? "wide" : "video"}
            />
          );
        }
        return (
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
        );
      })}
      {getItemSchema(section.section_type) && (
        <ItemListEditor
          sectionType={section.section_type}
          organizationId={section.organization_id}
          items={Array.isArray(c.items) ? (c.items as Array<Record<string, unknown>>) : []}
          onChange={(items) => onChange({ ...c, items })}
        />
      )}
    </div>
  );
}

function sectionNeedsImage(s: WebsiteSection): boolean {
  if (s.section_type !== "hero" && s.section_type !== "image_text") return false;
  const url = (s.content_json as Record<string, unknown>)?.image_url;
  return typeof url !== "string" || url.trim() === "";
}

function SectionPreview({
  section,
  selected,
  onSelect,
  onAddImage,
  onPickStarterPhoto,
}: {
  section: WebsiteSection;
  selected: boolean;
  onSelect: () => void;
  onAddImage?: () => void;
  onPickStarterPhoto?: (url: string) => void;
}) {
  const ring = selected ? "ring-2 ring-primary ring-inset" : "hover:ring-2 hover:ring-border hover:ring-inset";
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div
      onClick={onSelect}
      className={`relative cursor-pointer ${ring} ${section.visible ? "" : "opacity-40"}`}
    >
      {(onAddImage || onPickStarterPhoto) && sectionNeedsImage(section) && (
        <div className="absolute right-2 top-2 z-10">
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
                setMenuOpen((v) => !v);
              }}
              className="rounded-full border border-border bg-card/95 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur hover:border-primary hover:text-primary"
            >
              + Add an image
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border bg-card p-1 shadow-lg">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onAddImage?.();
                  }}
                  className="block w-full rounded px-2 py-1.5 text-left text-[11px] text-foreground hover:bg-muted"
                >
                  Upload or media library
                </button>
                {onPickStarterPhoto && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      setPickerOpen(true);
                    }}
                    className="block w-full rounded px-2 py-1.5 text-left text-[11px] text-foreground hover:bg-muted"
                  >
                    Use a starter photo
                  </button>
                )}
              </div>
            )}
          </div>

          {pickerOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-80 rounded-xl border border-border bg-card p-3 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Choose a starter photo</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPickerOpen(false);
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Close
                </button>
              </div>
              <StarterPhotosGrid
                compact
                onSelect={(url) => {
                  setPickerOpen(false);
                  onPickStarterPhoto?.(url);
                }}
              />
            </div>
          )}
        </div>
      )}
      <PublicSectionRenderer section={section as never} context={{ preview: true }} />
    </div>
  );
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
        ✨ Ask AI
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-2">
      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="e.g. make this about our 130th anniversary"
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
            catch (e) { toast.error(e instanceof Error && e.message ? e.message : "Generation failed — please try again."); }
            finally { setBusy(false); }
          }}
          className="rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Asking AI…" : "Run"}
        </button>
      </div>
    </div>
  );
}

function SortableSectionItem({
  id,
  index,
  label,
  selected,
  onSelect,
  onRemove,
  editor,
}: {
  id: string;
  index: number;
  label: string;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  editor: PresencePeer | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`relative ${isDragging ? "z-10 opacity-60" : ""} ${
        isOver && !isDragging ? "before:absolute before:-top-0.5 before:left-0 before:right-0 before:h-0.5 before:rounded-full before:bg-primary" : ""
      }`}
    >
      <div
        className={`group flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-xs ${
          selected ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60"
        }`}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${label}`}
          className="cursor-grab touch-none rounded px-1 text-muted-foreground/60 hover:bg-background hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        >
          ⋮⋮
        </button>
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <span className="truncate">{index + 1}. {label}</span>
          {editor && (
            <span
              title={`${editor.name} is editing this section`}
              className="inline-block size-2 shrink-0 rounded-full ring-2 ring-background"
              style={{ backgroundColor: editor.color }}
            />
          )}
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="rounded p-0.5 text-destructive opacity-0 hover:bg-background group-hover:opacity-100 focus-visible:opacity-100"
        >
          ×
        </button>
      </div>
    </li>
  );
}

function PresenceStack({ peers }: { peers: PresencePeer[] }) {
  if (peers.length === 0) return null;
  const visible = peers.slice(0, 4);
  const extra = peers.length - visible.length;
  return (
    <div className="flex items-center -space-x-1.5 pl-1">
      {visible.map((p) => (
        <div
          key={p.userId}
          title={`${p.name} is here`}
          className="flex size-6 items-center justify-center overflow-hidden rounded-full text-[10px] font-medium text-white ring-2 ring-card"
          style={{ backgroundColor: p.color }}
        >
          {p.avatarUrl ? (
            <img src={p.avatarUrl} alt={p.name} className="size-full object-cover" />
          ) : (
            (p.name?.[0] ?? "?").toUpperCase()
          )}
        </div>
      ))}
      {extra > 0 && (
        <div className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-card">
          +{extra}
        </div>
      )}
    </div>
  );
}
