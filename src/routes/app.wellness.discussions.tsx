import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useOrgWellness } from "@/hooks/use-org-wellness";
import { useWellnessCategory } from "@/hooks/use-wellness-category";
import { fetchProfilesByIds, sanitizeQaSearch, timeAgo, type QaPost } from "@/lib/qa";

export const Route = createFileRoute("/app/wellness/discussions")({
  head: () => ({
    meta: [
      { title: "Well-Being Discussions — LexGuild" },
      {
        name: "description",
        content: "A dedicated space to talk with colleagues about balance, stress, and practice health.",
      },
      { property: "og:title", content: "Well-Being Discussions — LexGuild" },
      {
        property: "og:description",
        content: "A dedicated space to talk with colleagues about balance, stress, and practice health.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WellnessDiscussions,
});

type Tab = "recent" | "unanswered" | "resolved";

function WellnessDiscussions() {
  const { user } = useAuth();
  const { currentOrgId } = useCurrentOrg();
  const { enabled, loading: wellnessLoading } = useOrgWellness();
  const { categoryId, loading: catLoading } = useWellnessCategory();
  const [tab, setTab] = useState<Tab>("recent");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [posts, setPosts] = useState<QaPost[]>([]);
  const [authors, setAuthors] = useState<Record<string, { full_name: string | null; avatar_url: string | null }>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!currentOrgId || !categoryId) return;
    setLoading(true);
    let q = supabase
      .from("qa_posts")
      .select("*")
      .eq("organization_id", currentOrgId)
      .eq("category_id", categoryId);

    if (tab === "unanswered") q = q.eq("reply_count", 0);
    if (tab === "resolved") q = q.eq("status", "resolved");
    if (search.trim()) {
      const safe = sanitizeQaSearch(search);
      if (safe.length > 0) q = q.or(`title.ilike.%${safe}%,body.ilike.%${safe}%`);
    }

    const { data } = await q
      .order("is_pinned", { ascending: false })
      .order("last_activity_at", { ascending: false })
      .limit(50);
    const rows = (data as QaPost[]) ?? [];
    setPosts(rows);
    setAuthors(await fetchProfilesByIds(rows.map((p) => p.author_id)));
    setLoading(false);
  }, [currentOrgId, categoryId, tab, search]);

  useEffect(() => {
    if (!catLoading && !categoryId) setLoading(false);
    void refresh();
  }, [refresh, catLoading, categoryId]);

  const askSearch = useMemo(() => (categoryId ? { category: categoryId } : {}), [categoryId]);

  if (wellnessLoading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-serif text-2xl font-semibold text-foreground">Well-Being discussions</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your organization hasn’t turned on the Well-Being program yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8 lg:py-10">
      <Link to="/app/wellness" className="text-xs font-medium text-muted-foreground hover:text-foreground">
        ← Back to Well-Being
      </Link>
      <header className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Support</p>
          <h1 className="font-serif text-2xl font-semibold text-foreground lg:text-3xl">Well-Being discussions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Talk with colleagues about balance, stress, and practice health. These conversations stay in this space.
          </p>
        </div>
        {categoryId && (
          <Link
            to="/app/qa/ask"
            search={askSearch}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant hover:bg-primary/90"
          >
            Start a discussion
          </Link>
        )}
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(searchInput.trim());
        }}
        className="mt-6"
      >
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search well-being discussions…"
          className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring/30 focus:ring-2"
        />
      </form>

      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-border">
        {(["recent", "unanswered", "resolved"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium capitalize transition ${
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {!categoryId && !catLoading ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
            <p className="text-sm font-medium text-foreground">Discussion space not set up yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              An organization admin can enable the Well-Being program to create this space.
            </p>
          </div>
        ) : loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading discussions…</p>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
            <p className="text-sm font-medium text-foreground">No discussions yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Be the first to start a well-being conversation.</p>
            {categoryId && (
              <Link
                to="/app/qa/ask"
                search={askSearch}
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant hover:bg-primary/90"
              >
                Start a discussion
              </Link>
            )}
          </div>
        ) : (
          posts.map((p) => (
            <Link
              key={p.id}
              to="/app/qa/$postId"
              params={{ postId: p.id }}
              className="block rounded-2xl border border-border bg-card p-4 shadow-card transition hover:shadow-elegant"
            >
              <div className="flex flex-wrap items-center gap-2">
                {p.is_pinned && <Tag>Pinned</Tag>}
                {p.status === "resolved" && <Tag>Resolved</Tag>}
              </div>
              <h2 className="mt-2 font-serif text-base font-semibold text-foreground">{p.title}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.body}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {authors[p.author_id]?.full_name ?? "Member"} · {timeAgo(p.created_at)}
                </span>
                <span>{p.reply_count} replies</span>
              </div>
            </Link>
          ))
        )}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
        Peer conversations are not a substitute for professional help. In crisis, call or text 988.
        {user ? "" : ""}
      </p>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{children}</span>
  );
}
