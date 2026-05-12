import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { Avatar } from "@/components/avatar";
import { initialsOf } from "@/hooks/use-profiles";
import { fetchProfilesByIds, timeAgo, type QaCategory, type QaPost, type QaReply } from "@/lib/qa";

export const Route = createFileRoute("/app/qa/$postId")({
  component: ThreadPage,
});

function ThreadPage() {
  const { postId } = Route.useParams();
  const { user } = useAuth();
  const { currentOrgId, isOrgAdmin, canWrite } = useCurrentOrg();
  const navigate = useNavigate();
  const [post, setPost] = useState<QaPost | null>(null);
  const [category, setCategory] = useState<QaCategory | null>(null);
  const [replies, setReplies] = useState<QaReply[]>([]);
  const [authors, setAuthors] = useState<Record<string, { full_name: string | null; avatar_url: string | null }>>({});
  const [following, setFollowing] = useState(false);
  const [body, setBody] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [helpfulMine, setHelpfulMine] = useState<Set<string>>(new Set());

  const refresh = async () => {
    const { data: p } = await supabase.from("qa_posts").select("*").eq("id", postId).maybeSingle();
    if (!p) {
      toast.error("Discussion not found");
      navigate({ to: "/app/qa" });
      return;
    }
    setPost(p as QaPost);
    if ((p as QaPost).category_id) {
      const { data: c } = await supabase.from("qa_categories").select("*").eq("id", (p as QaPost).category_id!).maybeSingle();
      setCategory((c as QaCategory) ?? null);
    }
    const { data: r } = await supabase
      .from("qa_replies")
      .select("*")
      .eq("post_id", postId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    const list = (r as QaReply[]) ?? [];
    setReplies(list);

    const ids = new Set<string>();
    if (!(p as QaPost).is_anonymous) ids.add((p as QaPost).author_id);
    list.forEach((x) => ids.add(x.author_id));
    setAuthors(await fetchProfilesByIds(Array.from(ids)));

    if (user) {
      const { data: f } = await supabase
        .from("qa_follows")
        .select("post_id")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .maybeSingle();
      setFollowing(!!f);

      const { data: rx } = await supabase
        .from("qa_reactions")
        .select("target_id")
        .eq("user_id", user.id)
        .eq("target_type", "reply")
        .eq("kind", "helpful")
        .in("target_id", list.map((x) => x.id));
      setHelpfulMine(new Set((rx ?? []).map((x: any) => x.target_id)));
    }
  };

  useEffect(() => {
    void refresh();
    const ch = supabase
      .channel(`qa-thread-${postId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "qa_replies", filter: `post_id=eq.${postId}` },
        () => void refresh(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, user]);

  const reply = async () => {
    if (!user || !post || !currentOrgId) return;
    if (body.trim().length < 2) return;
    setBusy(true);
    const { error } = await supabase.from("qa_replies").insert({
      post_id: post.id,
      organization_id: currentOrgId,
      author_id: user.id,
      body: body.trim(),
      is_private: isPrivate && post.allow_private_replies,
    });
    if (error) toast.error(error.message);
    else {
      setBody("");
      setIsPrivate(false);
      void refresh();
    }
    setBusy(false);
  };

  const toggleFollow = async () => {
    if (!user || !currentOrgId || !post) return;
    if (following) {
      await supabase.from("qa_follows").delete().eq("post_id", post.id).eq("user_id", user.id);
      setFollowing(false);
    } else {
      await supabase.from("qa_follows").insert({ post_id: post.id, user_id: user.id, organization_id: currentOrgId });
      setFollowing(true);
    }
  };

  const toggleHelpful = async (replyId: string) => {
    if (!user || !currentOrgId) return;
    if (helpfulMine.has(replyId)) {
      await supabase.from("qa_reactions").delete()
        .eq("user_id", user.id).eq("target_type", "reply").eq("target_id", replyId).eq("kind", "helpful");
    } else {
      await supabase.from("qa_reactions").insert({
        organization_id: currentOrgId, user_id: user.id, target_type: "reply", target_id: replyId, kind: "helpful",
      });
    }
    void refresh();
  };

  const markBest = async (replyId: string) => {
    if (!post) return;
    await supabase.from("qa_posts").update({ best_answer_id: replyId, status: "resolved" }).eq("id", post.id);
    void refresh();
  };

  const setStatus = async (status: "open" | "resolved" | "closed") => {
    if (!post) return;
    await supabase.from("qa_posts").update({ status }).eq("id", post.id);
    void refresh();
  };

  const togglePin = async () => {
    if (!post) return;
    await supabase.from("qa_posts").update({ is_pinned: !post.is_pinned }).eq("id", post.id);
    void refresh();
  };

  const deleteReply = async (id: string) => {
    if (!window.confirm("Delete this reply?")) return;
    await supabase.from("qa_replies").delete().eq("id", id);
    void refresh();
  };

  if (!post) return <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>;

  const isOP = user?.id === post.author_id;
  const author = post.is_anonymous ? null : authors[post.author_id];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-10">
      <Link to="/app/qa" className="text-xs font-medium text-muted-foreground hover:text-foreground">← Back to Community</Link>

      <article className="mt-3 rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          {post.is_pinned && <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[11px] font-medium text-gold">Pinned</span>}
          {post.is_urgent && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">Urgent</span>}
          {post.status === "resolved" && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Resolved</span>}
          {post.status === "closed" && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Closed</span>}
          {category && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-muted-foreground">{category.name}</span>}
        </div>
        <h1 className="mt-2 font-serif text-xl font-semibold text-foreground lg:text-2xl">{post.title}</h1>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{post.body}</p>
        {post.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {post.tags.map((t) => (
              <span key={t} className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-muted-foreground">#{t}</span>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {!post.is_anonymous && <Avatar initials={initialsOf(author?.full_name)} src={author?.avatar_url} size={28} />}
            <span>{post.is_anonymous ? "Anonymous member" : author?.full_name ?? "Member"} · {timeAgo(post.created_at)}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleFollow} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${following ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {following ? "Following" : "Follow"}
            </button>
            {isOP && post.status !== "resolved" && (
              <button onClick={() => setStatus("resolved")} className="text-xs text-emerald-700 hover:underline">Mark resolved</button>
            )}
            {isOrgAdmin && (
              <>
                <button onClick={togglePin} className="text-xs text-muted-foreground hover:text-foreground">{post.is_pinned ? "Unpin" : "Pin"}</button>
                <button onClick={() => setStatus(post.status === "closed" ? "open" : "closed")} className="text-xs text-muted-foreground hover:text-foreground">
                  {post.status === "closed" ? "Reopen" : "Close"}
                </button>
              </>
            )}
          </div>
        </div>
      </article>

      <h2 className="mt-6 font-serif text-base font-semibold text-foreground">
        {replies.length} {replies.length === 1 ? "reply" : "replies"}
      </h2>

      <div className="mt-3 space-y-3">
        {replies.map((r) => {
          const a = authors[r.author_id];
          const isBest = post.best_answer_id === r.id;
          const canEdit = user?.id === r.author_id || isOrgAdmin;
          return (
            <article
              key={r.id}
              className={`rounded-2xl border p-4 shadow-card ${isBest ? "border-gold bg-gold/5" : "border-border bg-card"}`}
            >
              {isBest && <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gold">★ Best answer</p>}
              {r.is_private && <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Private reply</p>}
              <div className="flex items-start gap-3">
                <Avatar initials={initialsOf(a?.full_name)} src={a?.avatar_url} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{a?.full_name ?? "Member"} <span className="text-xs font-normal text-muted-foreground">· {timeAgo(r.created_at)}</span></p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{r.body}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <button
                      onClick={() => toggleHelpful(r.id)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 ${helpfulMine.has(r.id) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      ↑ Helpful {r.helpful_count > 0 ? r.helpful_count : ""}
                    </button>
                    {isOP && !isBest && post.status !== "closed" && (
                      <button onClick={() => markBest(r.id)} className="text-gold hover:underline">Mark as best answer</button>
                    )}
                    {canEdit && (
                      <button onClick={() => deleteReply(r.id)} className="text-muted-foreground hover:text-destructive">Delete</button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {post.status !== "closed" && canWrite && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-card">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Write a reply…"
            className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring/30 focus:ring-2"
            maxLength={4000}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            {post.allow_private_replies ? (
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
                Private reply (visible only to the original poster)
              </label>
            ) : <span />}
            <button
              onClick={reply}
              disabled={busy || body.trim().length < 2}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-elegant hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Posting…" : "Post reply"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
