import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { fetchProfilesByIds, timeAgo, type QaPost, type QaReply } from "@/lib/qa";

export const Route = createFileRoute("/app/qa/search")({
  component: QaSearch,
});

type ReplyHit = QaReply & { post_title?: string };

function QaSearch() {
  const { currentOrgId } = useCurrentOrg();
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [posts, setPosts] = useState<QaPost[]>([]);
  const [replies, setReplies] = useState<ReplyHit[]>([]);
  const [authors, setAuthors] = useState<Record<string, { full_name: string | null; avatar_url: string | null }>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentOrgId || submitted.trim().length < 2) {
      setPosts([]); setReplies([]);
      return;
    }
    setLoading(true);
    (async () => {
      const term = submitted.trim();
      // Try full-text first; fall back to ilike if empty.
      const fts = supabase
        .from("qa_posts")
        .select("*")
        .eq("organization_id", currentOrgId)
        .textSearch("search_tsv", term, { type: "websearch", config: "english" })
        .order("last_activity_at", { ascending: false })
        .limit(40);
      const { data: postRows } = await fts;
      let postList = (postRows as QaPost[]) ?? [];
      if (postList.length === 0) {
        const { data: ilikeRows } = await supabase
          .from("qa_posts")
          .select("*")
          .eq("organization_id", currentOrgId)
          .or(`title.ilike.%${term}%,body.ilike.%${term}%`)
          .order("last_activity_at", { ascending: false })
          .limit(40);
        postList = (ilikeRows as QaPost[]) ?? [];
      }

      const { data: replyRows } = await supabase
        .from("qa_replies")
        .select("*")
        .eq("organization_id", currentOrgId)
        .is("deleted_at", null)
        .textSearch("search_tsv", term, { type: "websearch", config: "english" })
        .limit(30);
      let replyList = (replyRows as ReplyHit[]) ?? [];

      // Hydrate post titles for replies (one round trip).
      const postIds = Array.from(new Set(replyList.map((r) => r.post_id).filter((id) => !postList.some((p) => p.id === id))));
      if (postIds.length > 0) {
        const { data: morePosts } = await supabase
          .from("qa_posts")
          .select("id,title")
          .in("id", postIds);
        const titleMap = new Map<string, string>();
        (morePosts ?? []).forEach((p: any) => titleMap.set(p.id, p.title));
        replyList = replyList.map((r) => ({ ...r, post_title: titleMap.get(r.post_id) ?? "Discussion" }));
      } else {
        replyList = replyList.map((r) => ({ ...r, post_title: postList.find((p) => p.id === r.post_id)?.title }));
      }

      setPosts(postList);
      setReplies(replyList);
      const ids = [
        ...postList.filter((p) => !p.is_anonymous).map((p) => p.author_id),
        ...replyList.map((r) => r.author_id),
      ];
      setAuthors(await fetchProfilesByIds(ids));
      setLoading(false);
    })();
  }, [currentOrgId, submitted]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Search</p>
          <h1 className="font-serif text-2xl font-semibold text-foreground lg:text-3xl">Search the community</h1>
          <p className="mt-1 text-sm text-muted-foreground">Full-text search across questions and replies in your organization.</p>
        </div>
        <Link to="/app/qa" className="text-sm font-medium text-primary hover:underline">Back</Link>
      </header>

      <form
        onSubmit={(e) => { e.preventDefault(); setSubmitted(q); }}
        className="mt-6 flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try: probate deadline NY"
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring/30 focus:ring-2"
        />
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Search</button>
      </form>

      {loading && <p className="mt-6 text-sm text-muted-foreground">Searching…</p>}

      {!loading && submitted && (
        <>
          <Section title={`Questions (${posts.length})`}>
            {posts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matching questions.</p>
            ) : (
              <div className="space-y-2">
                {posts.map((p) => {
                  const a = p.is_anonymous ? null : authors[p.author_id];
                  return (
                    <Link key={p.id} to="/app/qa/$postId" params={{ postId: p.id }} className="block rounded-2xl border border-border bg-card p-4 hover:shadow-elegant">
                      <p className="font-serif font-semibold text-foreground">{p.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.body}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {p.is_anonymous ? "Anonymous" : a?.full_name ?? "Member"} · {p.reply_count} repl{p.reply_count === 1 ? "y" : "ies"} · {timeAgo(p.last_activity_at)}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </Section>

          <Section title={`Replies (${replies.length})`}>
            {replies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matching replies.</p>
            ) : (
              <div className="space-y-2">
                {replies.map((r) => {
                  const a = authors[r.author_id];
                  return (
                    <Link key={r.id} to="/app/qa/$postId" params={{ postId: r.post_id }} className="block rounded-2xl border border-border bg-card p-4 hover:shadow-elegant">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">In: {r.post_title}</p>
                      <p className="mt-1 line-clamp-3 text-sm text-foreground">{r.body}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{a?.full_name ?? "Member"} · {timeAgo(r.created_at)}</p>
                    </Link>
                  );
                })}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-base font-semibold text-foreground">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
