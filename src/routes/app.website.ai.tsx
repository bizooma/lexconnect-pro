import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { generatePageDraft } from "@/lib/website-ai.functions";
import { listAiGenerations } from "@/lib/website.functions";

export const Route = createFileRoute("/app/website/ai")({
  component: AiBuilderPage,
});

const PROMPT_PRESETS = [
  {
    label: "Annual Convention landing page",
    prompt:
      "Create a landing page for our annual bar association convention with a hero, key stats, agenda highlights, featured speakers, sponsorship tiers, FAQ, and registration CTA.",
  },
  {
    label: "Mentorship program overview",
    prompt:
      "Build a page introducing our mentorship program: hero, how it works, mentor/mentee benefits, testimonials, FAQ, and a sign-up CTA.",
  },
  {
    label: "Membership benefits",
    prompt:
      "Create a member benefits page with hero, feature grid (CLE, networking, advocacy, discounts), testimonials, pricing tiers, and a Join CTA.",
  },
  {
    label: "Pro bono / legal aid",
    prompt:
      "Build a legal aid resource page with hero, eligibility info, list of free clinics, partner organizations, FAQ, and a contact form.",
  },
];

type Generation = {
  id: string;
  kind: string;
  prompt: string;
  model: string | null;
  created_at: string;
};

function AiBuilderPage() {
  const navigate = useNavigate();
  const { currentOrgId } = useCurrentOrg();
  const gen = useServerFn(generatePageDraft);
  const listGens = useServerFn(listAiGenerations);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Generation[]>([]);

  const refresh = () => {
    if (!currentOrgId) return;
    listGens({ data: { organizationId: currentOrgId, limit: 20 } }).then((r) =>
      setHistory(r.generations as Generation[]),
    );
  };

  useEffect(refresh, [currentOrgId]);

  const generate = async () => {
    if (!currentOrgId || prompt.trim().length < 10) {
      toast.error("Describe what you want in at least a sentence.");
      return;
    }
    setBusy(true);
    try {
      const r = await gen({ data: { organizationId: currentOrgId, prompt: prompt.trim() } });
      toast.success("Draft created");
      navigate({ to: "/app/website/pages/$pageId", params: { pageId: r.pageId } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">✨ AI Page Builder</h2>
          <p className="text-sm text-muted-foreground">
            Describe the page you want and AI will scaffold it as a draft. You'll review and edit before publishing.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <label className="block text-sm font-medium text-foreground">What page do you want to build?</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={6}
            placeholder="e.g., A landing page for our 2026 spring CLE day with agenda, speakers, registration, and sponsor logos."
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            disabled={busy}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{prompt.length} chars · 3–10 sections will be generated</p>
            <button
              onClick={generate}
              disabled={busy || !currentOrgId}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Generating…" : "Generate Draft"}
            </button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick start</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {PROMPT_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setPrompt(p.prompt)}
                disabled={busy}
                className="rounded-lg border border-border bg-card p-3 text-left text-sm transition hover:border-primary disabled:opacity-60"
              >
                <p className="font-medium text-foreground">{p.label}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.prompt}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <aside className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Recent AI activity</h3>
        {history.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">No AI runs yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {history.map((g) => (
              <li key={g.id} className="border-b border-border pb-2 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                    {g.kind.replace("_", " ")}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(g.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-foreground">{g.prompt}</p>
                {g.model && <p className="mt-0.5 text-[10px] text-muted-foreground">{g.model}</p>}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
