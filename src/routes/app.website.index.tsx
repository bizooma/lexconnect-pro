import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { getWebsiteStats, listAiGenerations } from "@/lib/website.functions";
import { getWebsiteAnalytics } from "@/lib/website-analytics.functions";
import { STATUS_LABELS, type WebsitePageStatus } from "@/lib/website";

export const Route = createFileRoute("/app/website/")({
  component: WebsiteOverviewPage,
});

type Recent = { id: string; title: string; status: WebsitePageStatus; updated_at: string };
type HistoryItem = { id: string; page_id: string; action: string; published_at: string };
type AiItem = { id: string; kind: string; prompt: string; created_at: string };

function WebsiteOverviewPage() {
  const { currentOrgId } = useCurrentOrg();
  const stats = useServerFn(getWebsiteStats);
  const aiList = useServerFn(listAiGenerations);
  const analytics = useServerFn(getWebsiteAnalytics);

  const [counts, setCounts] = useState({ total: 0, draft: 0, published: 0, scheduled: 0 });
  const [recent, setRecent] = useState<Recent[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [ai, setAi] = useState<AiItem[]>([]);
  const [series, setSeries] = useState<{ date: string; views: number }[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [topPages, setTopPages] = useState<{ pageId: string; title: string; views: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrgId) return;
    setLoading(true);
    Promise.all([
      stats({ data: { organizationId: currentOrgId } }),
      aiList({ data: { organizationId: currentOrgId, limit: 10 } }),
      analytics({ data: { organizationId: currentOrgId, days: 30 } }),
    ])
      .then(([s, a, an]) => {
        setCounts({ total: s.total, draft: s.draft, published: s.published, scheduled: s.scheduled });
        setRecent(s.recent as Recent[]);
        setHistory(s.history as HistoryItem[]);
        setAi(a.generations as AiItem[]);
        setSeries(an.series);
        setTotalViews(an.total);
        setTopPages(an.topPages);
      })
      .finally(() => setLoading(false));
  }, [currentOrgId, stats, aiList, analytics]);

  if (!currentOrgId) {
    return <div className="text-sm text-muted-foreground">Select an organization to begin.</div>;
  }

  // Merge activity feeds, sorted by date desc
  const feed = [
    ...history.map((h) => ({
      id: `h-${h.id}`,
      ts: h.published_at,
      label: `Page ${h.action}`,
      sub: h.page_id.slice(0, 8),
    })),
    ...ai.map((a) => ({
      id: `a-${a.id}`,
      ts: a.created_at,
      label: `AI · ${a.kind.replace("_", " ")}`,
      sub: a.prompt.slice(0, 80),
    })),
    ...recent.map((r) => ({
      id: `p-${r.id}`,
      ts: r.updated_at,
      label: `Edited "${r.title}"`,
      sub: STATUS_LABELS[r.status],
    })),
  ]
    .sort((x, y) => y.ts.localeCompare(x.ts))
    .slice(0, 20);

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
        <Link
          to={"/app/website/ai" as any}
          className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
        >
          ✨ Generate with AI
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">Recent pages</h2>
            <Link to={"/app/website/pages" as any} className="text-xs text-primary hover:underline">
              View all →
            </Link>
          </header>
          {loading ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">No pages yet. Create your first page to get started.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((p) => (
                <li key={p.id}>
                  <Link
                    to="/app/website/pages/$pageId"
                    params={{ pageId: p.id }}
                    className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-accent/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{p.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Updated {new Date(p.updated_at).toLocaleDateString()}
                      </p>
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

        <section className="rounded-xl border border-border bg-card">
          <header className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">Activity feed</h2>
          </header>
          {loading ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Loading…</p>
          ) : feed.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {feed.map((f) => (
                <li key={f.id} className="px-5 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-xs font-medium text-foreground">{f.label}</p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {new Date(f.ts).toLocaleString()}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{f.sub}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
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
