import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getPagePublishHistory,
  restorePublishSnapshot,
  getWebsitePage,
} from "@/lib/website.functions";
import { alignSideBySide, diffLines, type SideRow } from "@/lib/website-diff";
import { toast } from "sonner";

export const Route = createFileRoute("/app/website/pages/$pageId/history")({
  component: HistoryPage,
});

type Snapshot = {
  title?: string;
  slug?: string;
  meta_title?: string;
  meta_description?: string;
  content_json?: unknown;
  status?: string;
  page_type?: string;
};

type Entry = {
  id: string;
  action: string;
  published_at: string;
  published_by: string | null;
  version_snapshot_json: Snapshot;
};

const ACTION_LABEL: Record<string, string> = {
  publish: "Published",
  schedule: "Scheduled",
  archive: "Archived",
  unpublish: "Unpublished",
};

const ACTION_BADGE: Record<string, string> = {
  publish: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  schedule: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  archive: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  unpublish: "bg-muted text-foreground",
};

type CompareMode = "previous" | "current";

const FIELDS: Array<{ key: keyof Snapshot; label: string; mono?: boolean; pretty?: boolean }> = [
  { key: "title", label: "Title" },
  { key: "slug", label: "Slug", mono: true },
  { key: "page_type", label: "Page type" },
  { key: "status", label: "Status" },
  { key: "meta_title", label: "Meta title" },
  { key: "meta_description", label: "Meta description" },
  { key: "content_json", label: "Content JSON", mono: true, pretty: true },
];

function asText(v: unknown, pretty = false): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try {
    return pretty ? JSON.stringify(v, null, 2) : JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function HistoryPage() {
  const { pageId } = Route.useParams();
  const navigate = useNavigate();
  const list = useServerFn(getPagePublishHistory);
  const restore = useServerFn(restorePublishSnapshot);
  const getPage = useServerFn(getWebsitePage);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [current, setCurrent] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<CompareMode>("previous");
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([list({ data: { pageId } }), getPage({ data: { pageId } })])
      .then(([h, p]) => {
        if (cancelled) return;
        const hist = (h.history ?? []) as Entry[];
        setEntries(hist);
        if (hist.length > 0) setSelectedId(hist[0].id);
        const pg = p.page as Record<string, unknown>;
        setCurrent({
          title: pg.title as string,
          slug: pg.slug as string,
          page_type: pg.page_type as string,
          status: pg.status as string,
          meta_title: (pg.meta_title as string) ?? "",
          meta_description: (pg.meta_description as string) ?? "",
          content_json: pg.content_json,
        });
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [pageId, list, getPage]);

  const selected = useMemo(() => entries.find((e) => e.id === selectedId) ?? null, [entries, selectedId]);
  const previous = useMemo(() => {
    if (!selected) return null;
    const idx = entries.findIndex((e) => e.id === selected.id);
    return idx >= 0 && idx + 1 < entries.length ? entries[idx + 1] : null;
  }, [entries, selected]);

  const left: Snapshot | null = compareMode === "previous" ? previous?.version_snapshot_json ?? null : selected?.version_snapshot_json ?? null;
  const right: Snapshot | null = compareMode === "previous" ? selected?.version_snapshot_json ?? null : current;

  const leftLabel = compareMode === "previous"
    ? previous ? `Previous · ${new Date(previous.published_at).toLocaleString()}` : "Previous (none)"
    : selected ? `Selected · ${new Date(selected.published_at).toLocaleString()}` : "Selected";
  const rightLabel = compareMode === "previous"
    ? selected ? `Selected · ${new Date(selected.published_at).toLocaleString()}` : "Selected"
    : "Current draft";

  const onRestore = async (entry: Entry) => {
    if (!confirm("Restore this version as a new draft? Current draft will be overwritten.")) return;
    setRestoring(true);
    try {
      await restore({ data: { historyId: entry.id } });
      toast.success("Snapshot restored as draft");
      navigate({ to: "/app/website/pages/$pageId", params: { pageId } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Publish history</h2>
          <p className="text-sm text-muted-foreground">All publish, schedule, archive, and unpublish events for this page.</p>
        </div>
        <Link
          to="/app/website/pages/$pageId"
          params={{ pageId }}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent"
        >
          ← Back to editor
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No publish events yet. History entries are created when you change the page status (publish, schedule, archive, unpublish).
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          {/* Timeline */}
          <ul className="space-y-2">
            {entries.map((e) => {
              const v = e.version_snapshot_json ?? {};
              const isActive = selectedId === e.id;
              return (
                <li key={e.id}>
                  <button
                    onClick={() => setSelectedId(e.id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      isActive ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ACTION_BADGE[e.action] ?? "bg-muted text-foreground"}`}>
                        {ACTION_LABEL[e.action] ?? e.action}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{new Date(e.published_at).toLocaleString()}</span>
                    </div>
                    <div className="mt-1.5 truncate text-sm font-medium text-foreground">{String(v.title ?? "—")}</div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground">/{String(v.slug ?? "")}</div>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Diff pane */}
          <section className="rounded-xl border border-border bg-card">
            {!selected ? (
              <p className="p-6 text-sm text-muted-foreground">Select an entry to inspect the snapshot.</p>
            ) : (
              <div className="flex flex-col">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {ACTION_LABEL[selected.action] ?? selected.action}
                    </h3>
                    <p className="text-xs text-muted-foreground">{new Date(selected.published_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-border bg-background p-0.5 text-xs">
                      <button
                        onClick={() => setCompareMode("previous")}
                        disabled={!previous}
                        className={`rounded-md px-2.5 py-1 transition ${
                          compareMode === "previous"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground disabled:opacity-50"
                        }`}
                      >
                        vs Previous
                      </button>
                      <button
                        onClick={() => setCompareMode("current")}
                        className={`rounded-md px-2.5 py-1 transition ${
                          compareMode === "current"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        vs Current draft
                      </button>
                    </div>
                    <button
                      onClick={() => onRestore(selected)}
                      disabled={restoring}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                    >
                      {restoring ? "Restoring…" : "Restore as draft"}
                    </button>
                  </div>
                </header>

                <div className="grid grid-cols-2 gap-px border-b border-border bg-border text-[11px] font-medium uppercase tracking-wide">
                  <div className="bg-muted/40 px-4 py-2 text-muted-foreground">{leftLabel}</div>
                  <div className="bg-muted/40 px-4 py-2 text-muted-foreground">{rightLabel}</div>
                </div>

                <div className="divide-y divide-border">
                  {FIELDS.map((f) => {
                    const lv = asText(left?.[f.key], !!f.pretty);
                    const rv = asText(right?.[f.key], !!f.pretty);
                    const changed = lv !== rv;
                    return (
                      <FieldDiff
                        key={f.key as string}
                        label={f.label}
                        left={lv}
                        right={rv}
                        changed={changed}
                        mono={!!f.mono}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function FieldDiff({
  label,
  left,
  right,
  changed,
  mono,
}: {
  label: string;
  left: string;
  right: string;
  changed: boolean;
  mono: boolean;
}) {
  const [open, setOpen] = useState(changed);
  useEffect(() => setOpen(changed), [changed]);
  const rows = useMemo<SideRow[]>(
    () => (changed ? alignSideBySide(diffLines(left, right)) : []),
    [left, right, changed],
  );

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-accent/40"
      >
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {changed ? (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
              Changed
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Unchanged
            </span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-px bg-border">
          {!changed ? (
            <>
              <Pane text={left} mono={mono} kind="equal" />
              <Pane text={right} mono={mono} kind="equal" />
            </>
          ) : (
            <>
              <DiffColumn rows={rows} side="left" mono={mono} />
              <DiffColumn rows={rows} side="right" mono={mono} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Pane({ text, mono, kind }: { text: string; mono: boolean; kind: "equal" | "add" | "remove" | "change" }) {
  const tone =
    kind === "add"
      ? "bg-emerald-500/10"
      : kind === "remove"
      ? "bg-rose-500/10"
      : kind === "change"
      ? "bg-amber-500/10"
      : "bg-card";
  return (
    <div className={`${tone} px-4 py-2 text-xs ${mono ? "font-mono" : ""}`}>
      {text ? (
        <pre className="whitespace-pre-wrap break-words text-foreground">{text}</pre>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </div>
  );
}

function DiffColumn({ rows, side, mono }: { rows: SideRow[]; side: "left" | "right"; mono: boolean }) {
  return (
    <div className={`max-h-[28rem] overflow-auto bg-card ${mono ? "font-mono" : ""}`}>
      {rows.map((row, i) => {
        const text = side === "left" ? row.left : row.right;
        const isChange = row.type === "change";
        const isRemove = row.type === "remove";
        const isAdd = row.type === "add";
        const present = side === "left" ? row.left !== null : row.right !== null;
        const tone = !present
          ? "bg-muted/20"
          : isChange
          ? "bg-amber-500/10"
          : side === "left" && isRemove
          ? "bg-rose-500/15"
          : side === "right" && isAdd
          ? "bg-emerald-500/15"
          : "";
        const marker = !present
          ? " "
          : side === "left" && isRemove
          ? "-"
          : side === "right" && isAdd
          ? "+"
          : isChange
          ? "~"
          : " ";
        return (
          <div key={`${side}-${i}`} className={`flex gap-2 px-4 py-0.5 text-xs leading-5 ${tone}`}>
            <span className="w-3 select-none text-muted-foreground">{marker}</span>
            <pre className="flex-1 whitespace-pre-wrap break-words text-foreground">{text ?? ""}</pre>
          </div>
        );
      })}
    </div>
  );
}
