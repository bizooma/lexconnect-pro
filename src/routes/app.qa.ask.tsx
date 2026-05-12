import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentOrg } from "@/hooks/use-current-org";
import type { QaCategory } from "@/lib/qa";
import { ResourceUploader } from "@/components/resources/resource-uploader";
import type { ResourceRow } from "@/lib/resources";

export const Route = createFileRoute("/app/qa/ask")({
  component: AskPage,
});

function AskPage() {
  const { user } = useAuth();
  const { currentOrgId, canWrite } = useCurrentOrg();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<QaCategory[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [allowPrivateReplies, setAllowPrivateReplies] = useState(false);
  const [attachments, setAttachments] = useState<ResourceRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!currentOrgId) return;
    supabase
      .from("qa_categories")
      .select("*")
      .eq("organization_id", currentOrgId)
      .eq("archived", false)
      .order("sort_order")
      .then(({ data }) => {
        const list = (data as QaCategory[]) ?? [];
        setCategories(list);
        if (list[0]) setCategoryId(list[0].id);
      });
  }, [currentOrgId]);

  const addTag = () => {
    const v = tagInput.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 40);
    if (v && !tags.includes(v) && tags.length < 8) setTags([...tags, v]);
    setTagInput("");
  };

  const submit = async () => {
    if (!user || !currentOrgId) return;
    if (!canWrite) {
      toast.error("Your subscription is inactive.");
      return;
    }
    if (title.trim().length < 6) {
      toast.error("Please write a clearer title (6+ chars).");
      return;
    }
    if (body.trim().length < 10) {
      toast.error("Please add more detail to your question.");
      return;
    }
    setBusy(true);
    try {
      const { data: post, error } = await supabase
        .from("qa_posts")
        .insert({
          organization_id: currentOrgId,
          author_id: user.id,
          category_id: categoryId || null,
          title: title.trim(),
          body: body.trim(),
          tags,
          is_urgent: isUrgent,
          is_anonymous: isAnonymous,
          allow_private_replies: allowPrivateReplies,
        })
        .select()
        .single();
      if (error || !post) throw error;

      if (attachments.length > 0) {
        const rows = attachments.map((a) => ({
          post_id: post.id,
          resource_id: a.id,
          organization_id: currentOrgId,
        }));
        await supabase.from("qa_post_attachments").insert(rows);
      }

      // Auto-follow your own question
      await supabase.from("qa_follows").insert({
        post_id: post.id,
        user_id: user.id,
        organization_id: currentOrgId,
      });

      toast.success("Question posted");
      navigate({ to: "/app/qa/$postId", params: { postId: post.id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not post your question.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 lg:px-8 lg:py-10">
      <Link to="/app/qa" className="text-xs font-medium text-muted-foreground hover:text-foreground">
        ← Back to Community
      </Link>
      <h1 className="mt-3 font-serif text-2xl font-semibold text-foreground">Ask the community</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your question is visible to members of your organization only.
      </p>

      <div className="mt-6 space-y-4">
        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="A clear, specific question"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring/30 focus:ring-2"
          />
        </Field>

        <Field label="Details">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder="Provide context, jurisdiction, statutes, deadlines — whatever helps colleagues respond."
            className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring/30 focus:ring-2"
            maxLength={8000}
          />
        </Field>

        <Field label="Category">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Tags" hint="Press Enter to add (max 8)">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-input bg-background px-2 py-1.5">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs">
                #{t}
                <button onClick={() => setTags(tags.filter((x) => x !== t))} className="text-muted-foreground hover:text-destructive">×</button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder={tags.length === 0 ? "e.g. probate, ny, deadline" : ""}
              className="flex-1 bg-transparent px-1 py-1 text-sm outline-none"
            />
          </div>
        </Field>

        <Field label="Attachments" hint="Optional — sample pleadings, checklists, templates">
          {currentOrgId && user && (
            <ResourceUploader
              organizationId={currentOrgId}
              uploaderUserId={user.id}
              visibility={"qa" as any}
              defaultCategory="template"
              showCategory={false}
              compact
              buttonLabel="Add attachment"
              onUploaded={(r) => setAttachments((prev) => [...prev, r])}
            />
          )}
          {attachments.length > 0 && (
            <ul className="mt-2 space-y-1">
              {attachments.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-lg bg-accent/40 px-3 py-1.5 text-xs">
                  <span className="truncate">{a.title}</span>
                  <button
                    onClick={() => setAttachments(attachments.filter((x) => x.id !== a.id))}
                    className="text-muted-foreground hover:text-destructive"
                  >Remove</button>
                </li>
              ))}
            </ul>
          )}
        </Field>

        <div className="space-y-2 rounded-lg border border-border bg-card p-3">
          <Toggle label="Mark as urgent" checked={isUrgent} onChange={setIsUrgent} />
          <Toggle label="Post anonymously to peers" checked={isAnonymous} onChange={setIsAnonymous} />
          <Toggle label="Allow private replies (visible only to me)" checked={allowPrivateReplies} onChange={setAllowPrivateReplies} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link to="/app/qa" className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</Link>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-elegant hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Posting…" : "Post question"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
      <span className="text-foreground">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition ${checked ? "bg-primary" : "bg-muted"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}
