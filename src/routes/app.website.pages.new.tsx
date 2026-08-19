import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { createWebsitePage, listTemplates, useTemplate } from "@/lib/website.functions";
import {
  generatePageDraft,
  generateFromTemplate,
  getAiQuota,
} from "@/lib/website-ai.functions";
import { PAGE_TYPE_LABELS, type WebsitePageType } from "@/lib/website";
import { toast } from "sonner";

export const Route = createFileRoute("/app/website/pages/new")({
  head: () => ({
    meta: [
      { title: "Create a page with AI — Website Builder" },
      {
        name: "description",
        content:
          "Describe the page you want or answer a few template questions, and AI drafts it for you.",
      },
    ],
  }),
  component: NewPagePage,
});

const STARTER_SECTIONS = [
  { section_type: "hero" as const, content_json: { headline: "Welcome", subheadline: "Tell visitors what you do.", cta_label: "Learn more" } },
  { section_type: "feature_grid" as const, content_json: { items: [] } },
  { section_type: "cta" as const, content_json: { headline: "Ready to get started?", cta_label: "Contact us" } },
];

type IntakeQuestion = { id: string; label: string; placeholder?: string };

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  page_type: WebsitePageType;
  default_sections_json: unknown;
  starter_prompt: string | null;
  intake_questions: IntakeQuestion[] | null;
};

const DRAFTING_MESSAGES = [
  "Drafting your page…",
  "Writing sections…",
  "Polishing the copy…",
];

function NewPagePage() {
  const { currentOrgId } = useCurrentOrg();
  const navigate = useNavigate();
  const create = useServerFn(createWebsitePage);
  const listTpls = useServerFn(listTemplates);
  const applyTpl = useServerFn(useTemplate);
  const aiFreeform = useServerFn(generatePageDraft);
  const aiTemplate = useServerFn(generateFromTemplate);
  const quotaFn = useServerFn(getAiQuota);

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [quota, setQuota] = useState<{ remaining: number; limit: number } | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState<null | string>(null);
  const [active, setActive] = useState<TemplateRow | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [manual, setManual] = useState(false);

  // Manual (no AI) form state
  const [title, setTitle] = useState("");
  const [pageType, setPageType] = useState<WebsitePageType>("custom");
  const [includeStarter, setIncludeStarter] = useState(true);
  const [manualTemplateId, setManualTemplateId] = useState<string>("");

  useEffect(() => {
    if (!currentOrgId) return;
    listTpls({ data: { organizationId: currentOrgId } })
      .then((r) => setTemplates(r.templates as unknown as TemplateRow[]))
      .catch(() => {});
    quotaFn({ data: { organizationId: currentOrgId } })
      .then((r) => setQuota({ remaining: r.remaining, limit: r.limit }))
      .catch(() => {});
  }, [currentOrgId, listTpls, quotaFn]);

  const quotaLabel = quota ? `${quota.remaining} of ${quota.limit} AI generations left this month` : null;

  const afterGenerate = (r: { pageId: string; droppedSections: number; remaining: number; limit: number }) => {
    setQuota({ remaining: r.remaining, limit: r.limit });
    toast.success("AI draft created — review everything before publishing.", {
      description:
        r.droppedSections > 0
          ? `${r.droppedSections} section${r.droppedSections === 1 ? "" : "s"} couldn't be generated and were skipped.`
          : undefined,
    });
    navigate({ to: "/app/website/pages/$pageId", params: { pageId: r.pageId } });
  };

  const runFreeform = async () => {
    if (!currentOrgId) return;
    if (prompt.trim().length < 10) {
      toast.error("Describe the page in at least a sentence.");
      return;
    }
    setBusy("freeform");
    try {
      afterGenerate(await aiFreeform({ data: { organizationId: currentOrgId, prompt: prompt.trim() } }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const runTemplate = async () => {
    if (!currentOrgId || !active) return;
    setBusy("template");
    try {
      afterGenerate(
        await aiTemplate({
          data: {
            organizationId: currentOrgId,
            templateId: active.id,
            answers: Object.fromEntries(
              Object.entries(answers).map(([k, v]) => [k, v.slice(0, 500)]),
            ),
          },
        }),
      );
      setActive(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const createManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrgId || !title.trim()) return;
    setBusy("manual");
    try {
      if (manualTemplateId) {
        const r = await applyTpl({
          data: { templateId: manualTemplateId, organizationId: currentOrgId, title: title.trim() },
        });
        toast.success("Page created from template");
        navigate({ to: "/app/website/pages/$pageId", params: { pageId: r.pageId } });
        return;
      }
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
      setBusy(null);
    }
  };

  const openTemplate = (t: TemplateRow) => {
    setActive(t);
    const qs = Array.isArray(t.intake_questions) ? t.intake_questions : [];
    setAnswers(Object.fromEntries(qs.map((q) => [q.id, ""])));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <h2 className="font-serif text-2xl font-semibold text-foreground">Create a page</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us what you need — AI drafts the page and you edit it before anything goes live.
        </p>
      </header>

      {/* Freeform prompt */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <label className="block">
          <span className="text-base font-semibold text-foreground">Describe the page you want</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            disabled={busy !== null}
            placeholder="A landing page for our 2026 annual convention in Austin, TX. Highlight CLE credits, networking, keynote speakers, and an early-bird registration discount ending March 1."
            className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm leading-relaxed text-foreground disabled:opacity-60"
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{quotaLabel ?? "\u00a0"}</p>
          <button
            onClick={runFreeform}
            disabled={busy !== null}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy === "freeform" ? DRAFTING_MESSAGES[0] : "✨ Generate"}
          </button>
        </div>
        {busy === "freeform" && <GeneratingBar />}
      </section>

      {/* Templates with intake questions */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Or start from a template</h3>
            <p className="text-xs text-muted-foreground">
              Answer a few questions and AI fills in the template for your organization.
            </p>
          </div>
        </div>

        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading templates…</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => {
              const qs = Array.isArray(t.intake_questions) ? t.intake_questions : [];
              return (
                <button
                  key={t.id}
                  onClick={() => openTemplate(t)}
                  disabled={busy !== null}
                  className="flex flex-col items-start rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/60 hover:shadow-sm disabled:opacity-50"
                >
                  <span className="text-sm font-semibold text-foreground">{t.name}</span>
                  <span className="text-xs text-muted-foreground">{PAGE_TYPE_LABELS[t.page_type]}</span>
                  <span className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    {t.starter_prompt || t.description || "Generate this page with AI."}
                  </span>
                  <span className="mt-3 text-[11px] font-medium text-primary">
                    {qs.length > 0 ? `✨ Answer ${qs.length} questions` : "✨ Generate"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Prefer to build it yourself?{" "}
        <button onClick={() => setManual((v) => !v)} className="text-primary hover:underline">
          Start from a blank page or template without AI
        </button>
      </p>

      {manual && (
        <form onSubmit={createManual} className="space-y-4 rounded-xl border border-border bg-card p-6">
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
            <span className="text-sm font-medium text-foreground">Template (optional)</span>
            <select
              value={manualTemplateId}
              onChange={(e) => setManualTemplateId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">No template — blank page</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>

          {!manualTemplateId && (
            <>
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
            </>
          )}

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
              disabled={busy !== null}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy === "manual" ? "Creating…" : "Create page"}
            </button>
          </div>
        </form>
      )}

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => busy === null && setActive(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-foreground">{active.name}</h3>
            {active.starter_prompt && (
              <p className="mt-1 text-xs text-muted-foreground">{active.starter_prompt}</p>
            )}

            <div className="mt-4 space-y-3">
              {(Array.isArray(active.intake_questions) ? active.intake_questions : []).map((q) => (
                <label key={q.id} className="block text-sm">
                  <span className="text-foreground">{q.label}</span>
                  <input
                    value={answers[q.id] ?? ""}
                    maxLength={500}
                    disabled={busy !== null}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    placeholder={q.placeholder}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
              ))}
              {(!active.intake_questions || active.intake_questions.length === 0) && (
                <p className="text-xs text-muted-foreground">
                  This template has no questions — AI will draft it from your organization details.
                </p>
              )}
            </div>

            {busy === "template" && <GeneratingBar />}

            <p className="mt-4 text-xs text-muted-foreground">{quotaLabel}</p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setActive(null)}
                disabled={busy !== null}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={runTemplate}
                disabled={busy !== null}
                className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {busy === "template" ? "Drafting your page…" : "✨ Generate page"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GeneratingBar() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % DRAFTING_MESSAGES.length), 2500);
    return () => clearInterval(t);
  }, []);
  const message = useMemo(() => DRAFTING_MESSAGES[i], [i]);
  return (
    <div className="mt-4 space-y-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/3 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
      </div>
      <p className="text-xs text-muted-foreground">{message} This usually takes 10–20 seconds.</p>
    </div>
  );
}
