import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useMyProfile } from "@/hooks/use-profiles";
import {
  FEED_LABELS,
  fetchProfilesByIds,
  sanitizeQaSearch,
  timeAgo,
  type FeedTab,
  type QaCategory,
  type QaPost,
} from "@/lib/qa";

export const Route = createFileRoute("/app/qa/")({
  component: QaFeed,
});

function QaFeed() {
  const { user } = useAuth();
  const { currentOrgId, isOrgAdmin } = useCurrentOrg();
  const { profile } = useMyProfile();
  const navigate = useNavigate();
  const [tab, setTab] = useState<FeedTab>("recent");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved">("all");
  const [categories, setCategories] = useState<QaCategory[]>([]);
  const [posts, setPosts] = useState<QaPost[]>([]);
  const [authors, setAuthors] = useState<Record<string, { full_name: string | null; avatar_url: string | null }>>({});
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Categories
  useEffect(() => {
    if (!currentOrgId) return;
    supabase
      .from("qa_categories")
      .select("*")
      .eq("organization_id", currentOrgId)
      .eq("archived", false)
      .order("sort_order")
      .then(({ data }) => setCategories((data as QaCategory[]) ?? []));
  }, [currentOrgId]);

  // Followed + saved posts
  useEffect(() => {
    if (!user || !currentOrgId) return;
    supabase
      .from("qa_follows")
      .select("post_id")
      .eq("user_id", user.id)
      .eq("organization_id", currentOrgId)
      .then(({ data }) => setFollowedIds(new Set((data ?? []).map((r: any) => r.post_id))));
    supabase
      .from("qa_bookmarks")
      .select("post_id")
      .eq("user_id", user.id)
      .eq("organization_id", currentOrgId)
      .then(({ data }) => setSavedIds(new Set((data ?? []).map((r: any) => r.post_id))));
  }, [user, currentOrgId]);

  const myPracticeAreas = useMemo(
    () => (profile?.practice_areas ?? []).map((s) => s.toLowerCase()),
    [profile],
  );

  const refresh = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    let q = supabase
      .from("qa_posts")
      .select("*")
      .eq("organization_id", currentOrgId);

    if (categoryId) q = q.eq("category_id", categoryId);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    if (search.trim()) {
      const safe = sanitizeQaSearch(search);
      if (safe.length > 0) {
        q = q.or(`title.ilike.%${safe}%,body.ilike.%${safe}%`);
      }
    }

    if (tab === "unanswered") q = q.eq("reply_count", 0);
    if (tab === "trending")
      q = q
        .gte("last_activity_at", new Date(Date.now() - 14 * 86400_000).toISOString())
        .order("reply_count", { ascending: false })
        .order("last_activity_at", { ascending: false });
    else q = q.order("is_pinned", { ascending: false }).order("last_activity_at", { ascending: false });

    if (tab === "following" || tab === "saved") {
      const ids = Array.from(tab === "following" ? followedIds : savedIds);
      if (ids.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }
      q = q.in("id", ids);
    }

    const { data } = await q.limit(50);
    let rows = (data as QaPost[]) ?? [];

    if (tab === "mine" && categories.length > 0 && myPracticeAreas.length > 0) {
      const matchingCatIds = new Set(
        categories.filter((c) => myPracticeAreas.includes(c.name.toLowerCase())).map((c) => c.id),
      );
      rows = rows.filter((p) => p.category_id && matchingCatIds.has(p.category_id));
    }

    setPosts(rows);
    const visibleAuthorIds = rows.filter((p) => !p.is_anonymous).map((p) => p.author_id);
    setAuthors(await fetchProfilesByIds(visibleAuthorIds));
    setLoading(false);
  }, [currentOrgId, tab, categoryId, statusFilter, search, followedIds, savedIds, categories, myPracticeAreas]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Uncategorized";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Knowledge</p>
          <h1 className="font-serif text-2xl font-semibold text-foreground lg:text-3xl">Community Q&amp;A</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask your colleagues, share templates, and search past discussions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/app/qa/categories" className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">Categories</Link>
          <Link to="/app/qa/search" className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">Search</Link>
          <Link to="/app/qa/notifications" className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">Notifications</Link>
          {isOrgAdmin && (
            <Link to="/app/qa/admin" className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">Moderate</Link>
          )}
          <button
            onClick={() => navigate({ to: "/app/qa/ask" })}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant hover:bg-primary/90"
          >
            <PlusIcon className="h-4 w-4" /> Ask the community
          </button>
        </div>
      </header>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput.trim());
          }}
          className="relative flex-1"
        >
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search questions, replies, tags…"
            className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-3 text-sm outline-none ring-ring/30 focus:ring-2"
          />
        </form>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
        >
          <option value="all">Any status</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-border">
        {(Object.keys(FEED_LABELS) as FeedTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {FEED_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Posts */}
      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading discussions…</p>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
            <p className="text-sm font-medium text-foreground">No discussions yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Be the first to ask the community a question.</p>
          </div>
        ) : (
          posts.map((p) => {
            const author = p.is_anonymous ? null : authors[p.author_id];
            return (
              <Link
                key={p.id}
                to="/app/qa/$postId"
                params={{ postId: p.id }}
                className="block rounded-2xl border border-border bg-card p-4 shadow-card transition hover:shadow-elegant"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {p.is_pinned && <Badge tone="gold">Pinned</Badge>}
                  {p.is_urgent && <Badge tone="urgent">Urgent</Badge>}
                  {p.status === "resolved" && <Badge tone="success">Resolved</Badge>}
                  {p.status === "closed" && <Badge tone="muted">Closed</Badge>}
                  <Badge tone="muted">{categoryName(p.category_id)}</Badge>
                </div>
                <h2 className="mt-2 font-serif text-base font-semibold text-foreground">{p.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.body}</p>
                {p.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.tags.slice(0, 5).map((t) => (
                      <span key={t} className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-muted-foreground">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {p.is_anonymous ? "Anonymous member" : author?.full_name ?? "Member"} · {timeAgo(p.created_at)}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <ChatIcon className="h-3.5 w-3.5" /> {p.reply_count}
                    </span>
                    {followedIds.has(p.id) && <span className="text-primary">Following</span>}
                    {savedIds.has(p.id) && <span className="text-gold">★ Saved</span>}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "muted" | "success" | "urgent" | "gold" }) {
  const cls = {
    muted: "bg-accent text-muted-foreground",
    success: "bg-emerald-50 text-emerald-700",
    urgent: "bg-red-50 text-red-700",
    gold: "bg-gold/10 text-gold",
  }[tone];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

function PlusIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14"/></svg>; }
function SearchIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>; }
function ChatIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 12a8 8 0 0 1-12.3 6.7L3 20l1.3-5.7A8 8 0 1 1 21 12z"/></svg>; }
