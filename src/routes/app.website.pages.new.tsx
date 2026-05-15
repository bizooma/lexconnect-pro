import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { createWebsitePage } from "@/lib/website.functions";
import { generatePageDraft } from "@/lib/website-ai.functions";
import { PAGE_TYPE_LABELS, type WebsitePageType } from "@/lib/website";
import { toast } from "sonner";

export const Route = createFileRoute("/app/website/pages/new")({
  component: NewPagePage,
});

const STARTER_SECTIONS = [
  { section_type: "hero" as const, content_json: { headline: "Welcome", subheadline: "Tell visitors what you do.", cta_label: "Learn more" } },
  { section_type: "feature_grid" as const, content_json: { items: [] } },
  { section_type: "cta" as const, content_json: { headline: "Ready to get started?", cta_label: "Contact us" } },
];

function NewPagePage() {
  const { currentOrgId } = useCurrentOrg();
  const navigate = useNavigate();
  const create = useServerFn(createWebsitePage);
  const aiGen = useServerFn(generatePageDraft);
  const [mode, setMode] = useState<"blank" | "ai">("blank");
  const [title, setTitle] = useState("");
  const [pageType, setPageType] = useState<WebsitePageType>("custom");
  const [includeStarter, setIncludeStarter] = useState(true);
  const [aiPrompt, setAiPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrgId || aiPrompt.trim().length < 10) return;
    setSubmitting(true);
    try {
      const r = await aiGen({ data: { organizationId: currentOrgId, prompt: aiPrompt.trim() } });
      toast.success("AI draft created");
      navigate({ to: "/app/website/pages/$pageId", params: { pageId: r.pageId } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrgId || !title.trim()) return;
    setSubmitting(true);
    try {
      const r = await create({
        data: {
          organizationId: currentOrgId,
          title: title.trim(),
          pageType,
          sections: includeStarter ? STARTER_SECTIONS : [],
        },
      });
      toast.success("Page created");
      navigate({ to: "/app/website/pages/$pageId", params: { pageId: r.pageId } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="font-serif text-xl font-semibold text-foreground">Create a new page</h2>
      <p className="mt-1 text-sm text-muted-foreground">Start blank, with a starter layout, or generate a draft with AI.</p>

      <div className="mt-4 inline-flex rounded-lg border border-border bg-card p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setMode("blank")}
          className={`rounded px-3 py-1.5 ${mode === "blank" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          Blank / Starter
        </button>
        <button
          type="button"
          onClick={() => setMode("ai")}
          className={`rounded px-3 py-1.5 ${mode === "ai" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          ✨ Generate with AI
        </button>
      </div>

      {mode === "ai" ? (
        <form onSubmit={submitAi} className="mt-6 space-y-4 rounded-xl border border-border bg-card p-6">
          <label className="block">
            <span className="text-sm font-medium text-foreground">Describe the page you want</span>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={6}
              required
              minLength={10}
              placeholder="A landing page for our 2026 annual convention in Austin, TX. Highlight CLE credits, networking, keynote speakers, and an early-bird registration discount ending March 1."
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <p className="text-xs text-muted-foreground">The AI will create a draft page you can edit before publishing.</p>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => navigate({ to: "/app/website/pages" as any })}
              className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-accent">Cancel</button>
            <button type="submit" disabled={submitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {submitting ? "Generating…" : "Generate draft"}
            </button>
          </div>
        </form>
      ) : (
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border border-border bg-card p-6">
        <label className="block">
          <span className="text-sm font-medium text-foreground">Page title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. 2026 Annual Convention"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">Page type</span>
          <select
            value={pageType}
            onChange={(e) => setPageType(e.target.value as WebsitePageType)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {Object.entries(PAGE_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={includeStarter}
            onChange={(e) => setIncludeStarter(e.target.checked)}
            className="h-4 w-4"
          />
          Include a 3-section starter (Hero · Features · CTA)
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => navigate({ to: "/app/website/pages" as any })}
            className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create page"}
          </button>
        </div>
      </form>
      )}
    </div>
  );
}
