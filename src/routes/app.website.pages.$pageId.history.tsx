import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPagePublishHistory, restorePublishSnapshot } from "@/lib/website.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/app/website/pages/$pageId/history")({
  component: HistoryPage,
});

type Entry = {
  id: string;
  action: string;
  published_at: string;
  published_by: string | null;
  version_snapshot_json: Record<string, unknown>;
};

const ACTION_LABEL: Record<string, string> = {
  publish: "Published",
  schedule: "Scheduled",
  archive: "Archived",
  unpublish: "Unpublished",
};

function HistoryPage() {
  const { pageId } = Route.useParams();
  const navigate = useNavigate();
  const list = useServerFn(getPagePublishHistory);
  const restore = useServerFn(restorePublishSnapshot);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    list({ data: { pageId } })
      .then((r) => setEntries((r.history ?? []) as Entry[]))
      .finally(() => setLoading(false));
  }, [pageId, list]);

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
    <div className="mx-auto max-w-5xl space-y-4">
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
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <ul className="space-y-2">
            {entries.map((e) => {
              const v = e.version_snapshot_json ?? {};
              const isActive = selected?.id === e.id;
              return (
                <li key={e.id}>
                  <button
                    onClick={() => setSelected(e)}
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      isActive ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                        {ACTION_LABEL[e.action] ?? e.action}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(e.published_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">{String(v.title ?? "—")}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">/{String(v.slug ?? "")}</div>
                  </button>
                </li>
              );
            })}
          </ul>

          <aside className="rounded-xl border border-border bg-card p-5">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Select an entry to inspect the snapshot.</p>
            ) : (
              <div className="space-y-4">
                <header className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Snapshot details</h3>
                    <p className="text-xs text-muted-foreground">
                      {ACTION_LABEL[selected.action] ?? selected.action} · {new Date(selected.published_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => onRestore(selected)}
                    disabled={restoring}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {restoring ? "Restoring…" : "Restore as draft"}
                  </button>
                </header>
                <Field label="Title" value={String((selected.version_snapshot_json as any).title ?? "")} />
                <Field label="Slug" value={String((selected.version_snapshot_json as any).slug ?? "")} />
                <Field label="Meta title" value={String((selected.version_snapshot_json as any).meta_title ?? "")} />
                <Field label="Meta description" value={String((selected.version_snapshot_json as any).meta_description ?? "")} multiline />
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Raw snapshot JSON</summary>
                  <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-muted p-3 text-xs">
{JSON.stringify(selected.version_snapshot_json, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground ${multiline ? "whitespace-pre-wrap" : "truncate"}`}>
        {value || <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}
