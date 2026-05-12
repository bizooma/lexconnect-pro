import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { Avatar } from "@/components/avatar";
import { initialsOf } from "@/hooks/use-profiles";
import { fetchProfilesByIds, timeAgo, type QaCategory, type QaPost, type QaReply } from "@/lib/qa";
import { ResourceUploader } from "@/components/resources/resource-uploader";
import type { ResourceRow } from "@/lib/resources";
import { getDownloadUrl } from "@/lib/resources";

export const Route = createFileRoute("/app/qa/$postId")({
  component: ThreadPage,
});

type AttachmentMap = Record<string, ResourceRow[]>; // keyed by post id or reply id

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
  const [saved, setSaved] = useState(false);
  const [body, setBody] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [helpfulMine, setHelpfulMine] = useState<Set<string>>(new Set());
  const [postAttachments, setPostAttachments] = useState<ResourceRow[]>([]);
  const [replyAttachments, setReplyAttachments] = useState<AttachmentMap>({});
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [pendingReplyAttachments, setPendingReplyAttachments] = useState<ResourceRow[]>([]);

  const refresh = useCallback(async () => {
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

    // Attachments — post + replies
    const [{ data: postAtt }, { data: replyAtt }] = await Promise.all([
      supabase
        .from("qa_post_attachments")
        .select("resource_id, resources:resource_id(*)")
        .eq("post_id", postId),
      list.length === 0
        ? Promise.resolve({ data: [] as any[] })
        : supabase
            .from("qa_reply_attachments")
            .select("reply_id, resource_id, resources:resource_id(*)")
            .in("reply_id", list.map((x) => x.id)),
    ]);
    setPostAttachments(((postAtt ?? []).map((row: any) => row.resources).filter(Boolean)) as ResourceRow[]);
    const map: AttachmentMap = {};
    ((replyAtt ?? []) as any[]).forEach((row) => {
      if (!row.resources) return;
      (map[row.reply_id] ??= []).push(row.resources);
    });
    setReplyAttachments(map);

    if (user) {
      const [{ data: f }, { data: b }] = await Promise.all([
        supabase.from("qa_follows").select("post_id").eq("post_id", postId).eq("user_id", user.id).maybeSingle(),
        supabase.from("qa_bookmarks").select("post_id").eq("post_id", postId).eq("user_id", user.id).maybeSingle(),
      ]);
      setFollowing(!!f);
      setSaved(!!b);

      if (list.length > 0) {
        const { data: rx } = await supabase
          .from("qa_reactions")
          .select("target_id")
          .eq("user_id", user.id)
          .eq("target_type", "reply")
          .eq("kind", "helpful")
          .in("target_id", list.map((x) => x.id));
        setHelpfulMine(new Set((rx ?? []).map((x: any) => x.target_id)));
      } else {
        setHelpfulMine(new Set());
      }
    }
  }, [postId, user, navigate]);

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
  }, [postId, refresh]);

  const tree = useMemo(() => buildReplyTree(replies), [replies]);

  const reply = async () => {
    if (!user || !post || !currentOrgId) return;
    if (body.trim().length < 2) return;
    setBusy(true);
    const { data: ins, error } = await supabase
      .from("qa_replies")
      .insert({
        post_id: post.id,
        organization_id: currentOrgId,
        author_id: user.id,
        body: body.trim(),
        is_private: isPrivate && post.allow_private_replies,
        parent_reply_id: replyToId,
      })
      .select()
      .single();
    if (error || !ins) {
      toast.error(error?.message ?? "Could not post reply");
      setBusy(false);
      return;
    }
    if (pendingReplyAttachments.length > 0) {
      const rows = pendingReplyAttachments.map((a) => ({
        reply_id: ins.id,
        resource_id: a.id,
        organization_id: currentOrgId,
      }));
      await supabase.from("qa_reply_attachments").insert(rows);
    }
    setBody("");
    setIsPrivate(false);
    setReplyToId(null);
    setPendingReplyAttachments([]);
    setBusy(false);
    void refresh();
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

  const toggleSaved = async () => {
    if (!user || !currentOrgId || !post) return;
    if (saved) {
      await supabase.from("qa_bookmarks").delete().eq("post_id", post.id).eq("user_id", user.id);
      setSaved(false);
    } else {
      await supabase.from("qa_bookmarks").insert({ post_id: post.id, user_id: user.id, organization_id: currentOrgId });
      setSaved(true);
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
        {postAttachments.length > 0 && (
          <AttachmentList items={postAttachments} />
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {!post.is_anonymous && <Avatar initials={initialsOf(author?.full_name)} src={author?.avatar_url} size={28} />}
            <span>{post.is_anonymous ? "Anonymous member" : author?.full_name ?? "Member"} · {timeAgo(post.created_at)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={toggleFollow} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${following ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {following ? "Following" : "Follow"}
            </button>
            <button onClick={toggleSaved} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${saved ? "bg-gold/10 text-gold" : "text-muted-foreground hover:text-foreground"}`}>
              {saved ? "★ Saved" : "☆ Save"}
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
        {tree.map((node) => (
          <ReplyNode
            key={node.reply.id}
            node={node}
            depth={0}
            authors={authors}
            attachments={replyAttachments}
            helpfulMine={helpfulMine}
            isOP={isOP}
            isOrgAdmin={isOrgAdmin}
            postStatus={post.status}
            bestAnswerId={post.best_answer_id}
            currentUserId={user?.id ?? null}
            onHelpful={toggleHelpful}
            onMarkBest={markBest}
            onDelete={deleteReply}
            onReplyTo={(id) => { setReplyToId(id); document.getElementById("qa-reply-form")?.scrollIntoView({ behavior: "smooth" }); }}
          />
        ))}
      </div>

      {post.status !== "closed" && canWrite && (
        <div id="qa-reply-form" className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-card">
          {replyToId && (
            <div className="mb-2 flex items-center justify-between rounded-lg bg-accent/40 px-3 py-1.5 text-xs">
              <span>Replying to a comment in this thread</span>
              <button onClick={() => setReplyToId(null)} className="text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
          )}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder={replyToId ? "Write your reply…" : "Write a reply…"}
            className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring/30 focus:ring-2"
            maxLength={4000}
          />

          {currentOrgId && user && (
            <div className="mt-2">
              <ResourceUploader
                organizationId={currentOrgId}
                uploaderUserId={user.id}
                visibility={"qa" as any}
                defaultCategory="template"
                showCategory={false}
                compact
                buttonLabel="Attach file"
                onUploaded={(r) => setPendingReplyAttachments((prev) => [...prev, r])}
              />
              {pendingReplyAttachments.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {pendingReplyAttachments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between rounded-lg bg-accent/40 px-3 py-1.5 text-xs">
                      <span className="truncate">{a.title}</span>
                      <button
                        onClick={() => setPendingReplyAttachments(pendingReplyAttachments.filter((x) => x.id !== a.id))}
                        className="text-muted-foreground hover:text-destructive"
                      >Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-2">
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

type ReplyTreeNode = { reply: QaReply; children: ReplyTreeNode[] };

function buildReplyTree(replies: QaReply[]): ReplyTreeNode[] {
  const byId = new Map<string, ReplyTreeNode>();
  replies.forEach((r) => byId.set(r.id, { reply: r, children: [] }));
  const roots: ReplyTreeNode[] = [];
  replies.forEach((r) => {
    const node = byId.get(r.id)!;
    if (r.parent_reply_id && byId.has(r.parent_reply_id)) {
      byId.get(r.parent_reply_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function ReplyNode({
  node, depth, authors, attachments, helpfulMine, isOP, isOrgAdmin, postStatus, bestAnswerId,
  currentUserId, onHelpful, onMarkBest, onDelete, onReplyTo,
}: {
  node: ReplyTreeNode; depth: number;
  authors: Record<string, { full_name: string | null; avatar_url: string | null }>;
  attachments: AttachmentMap;
  helpfulMine: Set<string>;
  isOP: boolean; isOrgAdmin: boolean;
  postStatus: QaPost["status"]; bestAnswerId: string | null;
  currentUserId: string | null;
  onHelpful: (id: string) => void;
  onMarkBest: (id: string) => void;
  onDelete: (id: string) => void;
  onReplyTo: (id: string) => void;
}) {
  const r = node.reply;
  const a = authors[r.author_id];
  const isBest = bestAnswerId === r.id;
  const canEdit = currentUserId === r.author_id || isOrgAdmin;
  const indent = depth === 0 ? "" : depth === 1 ? "ml-6 sm:ml-10" : "ml-12 sm:ml-16";
  const replyAtt = attachments[r.id] ?? [];

  return (
    <div className={indent}>
      <article
        className={`rounded-2xl border p-4 shadow-card ${isBest ? "border-gold bg-gold/5" : "border-border bg-card"}`}
      >
        {isBest && <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gold">★ Best answer</p>}
        {r.is_private && <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Private reply</p>}
        <div className="flex items-start gap-3">
          <Avatar initials={initialsOf(a?.full_name)} src={a?.avatar_url} size={32} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{a?.full_name ?? "Member"} <span className="text-xs font-normal text-muted-foreground">· {timeAgo(r.created_at)}</span></p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{r.body}</p>
            {replyAtt.length > 0 && <AttachmentList items={replyAtt} />}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <button
                onClick={() => onHelpful(r.id)}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 ${helpfulMine.has(r.id) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                ↑ Helpful {r.helpful_count > 0 ? r.helpful_count : ""}
              </button>
              {postStatus !== "closed" && depth < 2 && (
                <button onClick={() => onReplyTo(r.id)} className="text-muted-foreground hover:text-foreground">Reply</button>
              )}
              {isOP && !isBest && postStatus !== "closed" && (
                <button onClick={() => onMarkBest(r.id)} className="text-gold hover:underline">Mark as best answer</button>
              )}
              {canEdit && (
                <button onClick={() => onDelete(r.id)} className="text-muted-foreground hover:text-destructive">Delete</button>
              )}
            </div>
          </div>
        </div>
      </article>
      {node.children.length > 0 && (
        <div className="mt-3 space-y-3">
          {node.children.map((c) => (
            <ReplyNode
              key={c.reply.id}
              node={c}
              depth={depth + 1}
              authors={authors}
              attachments={attachments}
              helpfulMine={helpfulMine}
              isOP={isOP}
              isOrgAdmin={isOrgAdmin}
              postStatus={postStatus}
              bestAnswerId={bestAnswerId}
              currentUserId={currentUserId}
              onHelpful={onHelpful}
              onMarkBest={onMarkBest}
              onDelete={onDelete}
              onReplyTo={onReplyTo}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AttachmentList({ items }: { items: ResourceRow[] }) {
  return (
    <ul className="mt-3 space-y-1">
      {items.map((a) => (
        <li key={a.id}>
          <button
            onClick={async () => {
              try {
                const url = await getDownloadUrl(a.storage_path);
                window.open(url, "_blank", "noopener,noreferrer");
              } catch {
                toast.error("Could not open file");
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-accent/40 px-3 py-1.5 text-xs hover:bg-accent"
          >
            <span aria-hidden>📎</span>
            <span className="truncate">{a.title}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
