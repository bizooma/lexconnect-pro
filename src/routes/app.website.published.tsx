import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { listWebsitePages, setPageStatus } from "@/lib/website.functions";
import { STATUS_LABELS, PAGE_TYPE_LABELS, type WebsitePageStatus, type WebsitePageType } from "@/lib/website";

export const Route = createFileRoute("/app/website/published")({
  component: PublishedListPage,
});

type Row = {
  id: string;
  title: string;
  slug: string;
  status: WebsitePageStatus;
  page_type: WebsitePageType;
  updated_at: string;
  published_at: string | null;
  scheduled_at: string | null;
};

function PublishedListPage() {
  const { currentOrgId } = useCurrentOrg();
  const list = useServerFn(listWebsitePages);
  const setStatus = useServerFn(setPageStatus);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"published" | "scheduled" | "archived">("published");

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
      <div>
        <h2 className="text-lg font-semibold text-foreground">Published & Scheduled</h2>
        <p className="text-sm text-muted-foreground">Live pages, scheduled releases, and the archive.</p>
      </div>

      <div className="flex gap-2">
        {(["published", "scheduled", "archived"] as const).map((k) => (
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
          <p className="p-6 text-sm text-muted-foreground">No pages here yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((p) => {
              const dateLabel =
                tab === "scheduled"
                  ? p.scheduled_at && `Scheduled for ${new Date(p.scheduled_at).toLocaleString()}`
                  : tab === "published"
                  ? p.published_at && `Published ${new Date(p.published_at).toLocaleDateString()}`
                  : `Updated ${new Date(p.updated_at).toLocaleDateString()}`;
              return (
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
                      /{p.slug} · {PAGE_TYPE_LABELS[p.page_type]}
                      {dateLabel ? ` · ${dateLabel}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Link
                      to="/app/website/pages/$pageId/history"
                      params={{ pageId: p.id }}
                      className="rounded-lg border border-border px-3 py-1.5 text-foreground hover:bg-accent"
                    >
                      History
                    </Link>
                    {tab === "published" && (
                      <button
                        onClick={async () => {
                          await setStatus({ data: { pageId: p.id, status: "draft" } });
                          toast.success("Unpublished — moved back to draft");
                          refresh();
                        }}
                        className="rounded-lg border border-border px-3 py-1.5 text-foreground hover:bg-accent"
                      >
                        Unpublish
                      </button>
                    )}
                    {tab === "archived" && (
                      <button
                        onClick={async () => {
                          await setStatus({ data: { pageId: p.id, status: "draft" } });
                          toast.success("Restored to draft");
                          refresh();
                        }}
                        className="rounded-lg border border-border px-3 py-1.5 text-foreground hover:bg-accent"
                      >
                        Restore
                      </button>
                    )}
                    {tab !== "archived" && (
                      <button
                        onClick={async () => {
                          await setStatus({ data: { pageId: p.id, status: "archived" } });
                          toast.success("Archived");
                          refresh();
                        }}
                        className="text-destructive hover:underline"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
