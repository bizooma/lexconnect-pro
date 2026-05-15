import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { listWebsitePages, setPageStatus, deleteWebsitePage } from "@/lib/website.functions";
import { STATUS_LABELS, PAGE_TYPE_LABELS, type WebsitePageStatus, type WebsitePageType } from "@/lib/website";

export const Route = createFileRoute("/app/website/drafts")({
  component: DraftsQueuePage,
});

type Row = {
  id: string;
  title: string;
  slug: string;
  status: WebsitePageStatus;
  page_type: WebsitePageType;
  updated_at: string;
};

function DraftsQueuePage() {
  const { currentOrgId } = useCurrentOrg();
  const list = useServerFn(listWebsitePages);
  const setStatus = useServerFn(setPageStatus);
  const del = useServerFn(deleteWebsitePage);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"draft" | "ready_for_review">("draft");

  const refresh = () => {
    if (!currentOrgId) return;
    setLoading(true);
    list({ data: { organizationId: currentOrgId, status: tab } })
      .then((r) => setRows(r.pages as Row[]))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, [currentOrgId, tab]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Drafts Queue</h2>
          <p className="text-sm text-muted-foreground">Work-in-progress pages awaiting review or publish.</p>
        </div>
        <Link
          to="/app/website/pages/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          + New Page
        </Link>
      </div>

      <div className="flex gap-2">
        {(["draft", "ready_for_review"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              tab === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {STATUS_LABELS[k]}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nothing here. All pages have been moved forward.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-accent/30">
                <div className="min-w-0">
                  <Link
                    to="/app/website/pages/$pageId"
                    params={{ pageId: p.id }}
                    className="truncate text-sm font-medium text-foreground hover:underline"
                  >
                    {p.title}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    /{p.slug} · {PAGE_TYPE_LABELS[p.page_type]} · updated {new Date(p.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {tab === "draft" && (
                    <button
                      onClick={async () => {
                        await setStatus({ data: { pageId: p.id, status: "ready_for_review" } });
                        toast.success("Sent to review");
                        refresh();
                      }}
                      className="rounded-lg border border-border px-3 py-1.5 text-foreground hover:bg-accent"
                    >
                      Send to review
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      await setStatus({ data: { pageId: p.id, status: "published" } });
                      toast.success("Published");
                      refresh();
                    }}
                    className="rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90"
                  >
                    Publish
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete "${p.title}"?`)) return;
                      await del({ data: { pageId: p.id } });
                      refresh();
                    }}
                    className="text-destructive hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
