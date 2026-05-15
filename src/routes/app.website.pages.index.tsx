import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { listWebsitePages, deleteWebsitePage, duplicateWebsitePage } from "@/lib/website.functions";
import { STATUS_LABELS, PAGE_TYPE_LABELS, type WebsitePageStatus, type WebsitePageType } from "@/lib/website";
import { toast } from "sonner";

export const Route = createFileRoute("/app/website/pages/")({
  component: PagesListPage,
});

type Row = {
  id: string;
  title: string;
  slug: string;
  status: WebsitePageStatus;
  page_type: WebsitePageType;
  updated_at: string;
};

function PagesListPage() {
  const { currentOrgId } = useCurrentOrg();
  const list = useServerFn(listWebsitePages);
  const del = useServerFn(deleteWebsitePage);
  const dup = useServerFn(duplicateWebsitePage);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<WebsitePageStatus | "all">("all");

  const refresh = () => {
    if (!currentOrgId) return;
    setLoading(true);
    list({ data: { organizationId: currentOrgId } })
      .then((r) => setRows(r.pages as Row[]))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, [currentOrgId]);

  const filtered = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["all", "draft", "ready_for_review", "scheduled", "published", "archived"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                filter === k
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {k === "all" ? "All" : STATUS_LABELS[k]}
            </button>
          ))}
        </div>
        <Link
          to="/app/website/pages/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          + New Page
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No pages match this filter.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Updated</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3">
                    <Link
                      to="/app/website/pages/$pageId"
                      params={{ pageId: p.id }}
                      className="font-medium text-foreground hover:underline"
                    >
                      {p.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">/{p.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{PAGE_TYPE_LABELS[p.page_type]}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                      {STATUS_LABELS[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(p.updated_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3 text-xs">
                      <button
                        onClick={async () => {
                          await dup({ data: { pageId: p.id } });
                          toast.success("Page duplicated");
                          refresh();
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete "${p.title}"?`)) return;
                          await del({ data: { pageId: p.id } });
                          toast.success("Page deleted");
                          refresh();
                        }}
                        className="text-destructive hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
