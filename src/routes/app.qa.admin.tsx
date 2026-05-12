import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { toast } from "sonner";
import { timeAgo, type QaCategory, type QaPost } from "@/lib/qa";

export const Route = createFileRoute("/app/qa/admin")({
  component: QaAdmin,
});

function QaAdmin() {
  const { currentOrgId, isOrgAdmin, loading: orgLoading } = useCurrentOrg();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<QaCategory[]>([]);
  const [posts, setPosts] = useState<QaPost[]>([]);
  const [newCat, setNewCat] = useState("");
  const [stats, setStats] = useState({ posts: 0, replies: 0, openUnanswered: 0 });

  useEffect(() => {
    if (!orgLoading && !isOrgAdmin) navigate({ to: "/app/qa" });
  }, [orgLoading, isOrgAdmin, navigate]);

  const refresh = async () => {
    if (!currentOrgId) return;
    const [cats, ps, allPosts, replies] = await Promise.all([
      supabase.from("qa_categories").select("*").eq("organization_id", currentOrgId).order("sort_order"),
      supabase.from("qa_posts").select("*").eq("organization_id", currentOrgId).order("is_pinned", { ascending: false }).order("last_activity_at", { ascending: false }).limit(50),
      supabase.from("qa_posts").select("id,reply_count,status", { count: "exact", head: false }).eq("organization_id", currentOrgId),
      supabase.from("qa_replies").select("id", { count: "exact", head: true }).eq("organization_id", currentOrgId),
    ]);
    setCategories((cats.data as QaCategory[]) ?? []);
    setPosts((ps.data as QaPost[]) ?? []);
    const openUnanswered = ((allPosts.data as any[]) ?? []).filter((p) => p.status === "open" && p.reply_count === 0).length;
    setStats({ posts: allPosts.data?.length ?? 0, replies: replies.count ?? 0, openUnanswered });
  };

  useEffect(() => { void refresh(); }, [currentOrgId]);

  const togglePin = async (p: QaPost) => {
    const { error } = await supabase.from("qa_posts").update({ is_pinned: !p.is_pinned }).eq("id", p.id);
    if (error) toast.error(error.message); else { toast.success(p.is_pinned ? "Unpinned" : "Pinned"); refresh(); }
  };
  const close = async (p: QaPost) => {
    const next = p.status === "closed" ? "open" : "closed";
    const { error } = await supabase.from("qa_posts").update({ status: next }).eq("id", p.id);
    if (error) toast.error(error.message); else { toast.success(next === "closed" ? "Closed" : "Reopened"); refresh(); }
  };
  const remove = async (p: QaPost) => {
    if (!confirm("Delete this question and all its replies?")) return;
    const { error } = await supabase.from("qa_posts").delete().eq("id", p.id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); refresh(); }
  };

  const addCategory = async () => {
    const name = newCat.trim();
    if (!name || !currentOrgId) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const sort = (categories[categories.length - 1]?.sort_order ?? 0) + 10;
    const { error } = await supabase.from("qa_categories").insert({ organization_id: currentOrgId, name, slug, sort_order: sort });
    if (error) toast.error(error.message); else { setNewCat(""); refresh(); }
  };
  const archiveCat = async (c: QaCategory) => {
    const { error } = await supabase.from("qa_categories").update({ archived: !c.archived }).eq("id", c.id);
    if (error) toast.error(error.message); else refresh();
  };
  const renameCat = async (c: QaCategory) => {
    const name = prompt("Rename category", c.name);
    if (!name || name === c.name) return;
    const { error } = await supabase.from("qa_categories").update({ name }).eq("id", c.id);
    if (error) toast.error(error.message); else refresh();
  };

  if (!isOrgAdmin) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Moderation</p>
          <h1 className="font-serif text-2xl font-semibold text-foreground lg:text-3xl">Community admin</h1>
        </div>
        <Link to="/app/qa" className="text-sm font-medium text-primary hover:underline">Back to feed</Link>
      </header>

      <section className="mt-6 grid grid-cols-3 gap-3">
        <Stat v={stats.posts} l="Total questions" />
        <Stat v={stats.replies} l="Total replies" />
        <Stat v={stats.openUnanswered} l="Unanswered" />
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg font-semibold text-foreground">Categories</h2>
        <div className="mt-3 flex gap-2">
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="New category name"
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <button onClick={addCategory} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Add</button>
        </div>
        <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className={c.archived ? "text-muted-foreground line-through" : "text-foreground"}>{c.name}</span>
              <span className="flex gap-3 text-xs">
                <button onClick={() => renameCat(c)} className="text-muted-foreground hover:text-foreground">Rename</button>
                <button onClick={() => archiveCat(c)} className="text-muted-foreground hover:text-foreground">{c.archived ? "Restore" : "Archive"}</button>
              </span>
            </li>
          ))}
          {categories.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No categories yet.</li>}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg font-semibold text-foreground">Recent questions</h2>
        <div className="mt-3 space-y-2">
          {posts.map((p) => (
            <article key={p.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to="/app/qa/$postId" params={{ postId: p.id }} className="font-medium text-foreground hover:underline">{p.title}</Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.status} · {p.reply_count} repl{p.reply_count === 1 ? "y" : "ies"} · {timeAgo(p.last_activity_at)}
                    {p.is_pinned && " · Pinned"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2 text-xs">
                  <button onClick={() => togglePin(p)} className="rounded-lg border border-border px-2 py-1 hover:bg-accent">{p.is_pinned ? "Unpin" : "Pin"}</button>
                  <button onClick={() => close(p)} className="rounded-lg border border-border px-2 py-1 hover:bg-accent">{p.status === "closed" ? "Reopen" : "Close"}</button>
                  <button onClick={() => remove(p)} className="rounded-lg border border-border px-2 py-1 text-destructive hover:bg-destructive/10">Delete</button>
                </div>
              </div>
            </article>
          ))}
          {posts.length === 0 && <p className="text-sm text-muted-foreground">No questions yet.</p>}
        </div>
      </section>
    </div>
  );
}

function Stat({ v, l }: { v: number; l: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="font-serif text-2xl font-semibold text-foreground">{v}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{l}</p>
    </div>
  );
}
