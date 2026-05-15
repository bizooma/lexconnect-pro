import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { listWebsitePages } from "@/lib/website.functions";
import { STATUS_LABELS, type WebsitePageStatus } from "@/lib/website";

export const Route = createFileRoute("/app/website/")({
  component: WebsiteOverviewPage,
});

type PageRow = {
  id: string;
  title: string;
  slug: string;
  status: WebsitePageStatus;
  page_type: string;
  updated_at: string;
};

function WebsiteOverviewPage() {
  const { currentOrgId } = useCurrentOrg();
  const list = useServerFn(listWebsitePages);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrgId) return;
    setLoading(true);
    list({ data: { organizationId: currentOrgId } })
      .then((r) => setPages(r.pages as PageRow[]))
      .catch(() => setPages([]))
      .finally(() => setLoading(false));
  }, [currentOrgId, list]);

  if (!currentOrgId) {
    return <div className="text-sm text-muted-foreground">Select an organization to begin.</div>;
  }

  const counts = {
    total: pages.length,
    draft: pages.filter((p) => p.status === "draft").length,
    published: pages.filter((p) => p.status === "published").length,
    scheduled: pages.filter((p) => p.status === "scheduled").length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Total Pages" value={counts.total} />
        <Stat label="Drafts" value={counts.draft} />
        <Stat label="Published" value={counts.published} />
        <Stat label="Scheduled" value={counts.scheduled} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/app/website/pages/new"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant hover:opacity-90"
        >
          + Create New Page
        </Link>
        <Link
          to={"/app/website/templates" as any}
          className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
        >
          Use a Template
        </Link>
      </div>

      <section className="rounded-xl border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">Recent pages</h2>
          <Link to={"/app/website/pages" as any} className="text-xs text-primary hover:underline">
            View all →
          </Link>
        </header>
        {loading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Loading…</p>
        ) : pages.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No pages yet. Create your first page to get started.</p>
        ) : (
          <ul className="divide-y divide-border">
            {pages.slice(0, 8).map((p) => (
              <li key={p.id}>
                <Link
                  to="/app/website/pages/$pageId"
                  params={{ pageId: p.id }}
                  className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-accent/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{p.title}</p>
                    <p className="truncate text-xs text-muted-foreground">/{p.slug}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    {STATUS_LABELS[p.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
