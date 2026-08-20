import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";

import { generateSite, getAiQuota } from "@/lib/website-ai.functions";
import { getWebsitePage } from "@/lib/website.functions";
import { TemplateMiniPreview } from "@/components/website/TemplateMiniPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/app/website/build")({
  component: BuildSiteWizard,
  head: () => ({
    meta: [
      { title: "Build your site with AI | Website Builder" },
      {
        name: "description",
        content:
          "Answer a few questions about your organization and generate a complete draft website in one run.",
      },
      { property: "og:title", content: "Build your site with AI" },
      {
        property: "og:description",
        content: "Generate a complete draft website for your bar association in one run.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type PageMode = "template" | "freeform" | "module_intro";
type Row = {
  key: string;
  title: string;
  mode: PageMode;
  templateName?: string;
  moduleTarget?: "sponsors" | "wellbeing";
  brief: string;
  checked: boolean;
  optional: boolean;
};
type RowStatus = "pending" | "running" | "done" | "error";
type Result = { key: string; pageId: string | null; slug: string | null; error: string | null };

const PROFILE_EMPTY = {
  founded_year: "",
  region: "",
  audience: "",
  tone: "",
  primary_goal: "",
  programs: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

function baseRows(hasWellness: boolean, hasSponsors: boolean): Row[] {
  return [
    {
      key: "home",
      title: "Home",
      mode: "template",
      templateName: "Bar Association Homepage",
      brief: "Welcome visitors, highlight membership, events and programs.",
      checked: true,
      optional: false,
    },
    {
      key: "join",
      title: "Join / Membership",
      mode: "template",
      templateName: "Join / Renew Membership",
      brief: "Explain membership tiers, benefits and how to join or renew.",
      checked: true,
      optional: false,
    },
    {
      key: "about",
      title: "About & Committees",
      mode: "template",
      templateName: "Committee Page",
      brief: "Our history, leadership and the committees members can join.",
      checked: true,
      optional: false,
    },
    {
      key: "contact",
      title: "Contact",
      mode: "freeform",
      brief: "How to reach the association: office hours, phone, email and address.",
      checked: true,
      optional: false,
    },
    {
      key: "legal-aid",
      title: "Legal Aid Resources",
      mode: "template",
      templateName: "Legal Aid Resource Page",
      brief: "Pro bono and legal aid resources for the public and volunteers.",
      checked: false,
      optional: true,
    },
    {
      key: "wellbeing",
      title: "Well-Being",
      mode: hasWellness ? "module_intro" : "template",
      templateName: hasWellness ? undefined : "Attorney Well-Being Resources",
      moduleTarget: hasWellness ? "wellbeing" : undefined,
      brief: "Attorney well-being support, confidential help and programs.",
      checked: false,
      optional: true,
    },
    {
      key: "sponsors",
      title: "Sponsors",
      mode: hasSponsors ? "module_intro" : "template",
      templateName: hasSponsors ? undefined : "Sponsorship Opportunities",
      moduleTarget: hasSponsors ? "sponsors" : undefined,
      brief: "Thank our sponsors and invite new sponsorship partners.",
      checked: false,
      optional: true,
    },
    {
      key: "newsletter",
      title: "Newsletter",
      mode: "template",
      templateName: "Newsletter Article",
      brief: "Association news and updates for members.",
      checked: false,
      optional: true,
    },
  ];
}

function BuildSiteWizard() {
  const { currentOrgId, isOrgAdmin, loading } = useCurrentOrg();
  const navigate = useNavigate();
  const runGenerate = useServerFn(generateSite);
  const quotaFn = useServerFn(getAiQuota);
  const pageFn = useServerFn(getWebsitePage);

  type Quota = {
    used: number;
    limit: number;
    remaining: number;
    purchased: number;
    period: string;
    resetsOn: string;
  };

  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({ ...PROFILE_EMPTY });
  const [rows, setRows] = useState<Row[]>([]);
  const [quota, setQuota] = useState<Quota>({ used: 0, limit: 0, remaining: 0, purchased: 0, period: "", resetsOn: "" });
  const [running, setRunning] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({});
  const [results, setResults] = useState<Result[] | null>(null);
  const [previews, setPreviews] = useState<Record<string, { title: string; sections: unknown }>>({});
  const [fatal, setFatal] = useState<string | null>(null);


  useEffect(() => {
    if (!currentOrgId) return;
    let cancelled = false;
    (async () => {
      const [org, sponsors, prof, q] = await Promise.all([
        supabase.from("organizations").select("wellness_enabled").eq("id", currentOrgId).maybeSingle(),
        supabase
          .from("org_sponsors")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", currentOrgId)
          .eq("status", "active"),
        supabase
          .from("org_site_profile")
          .select("founded_year, region, audience, tone, primary_goal, programs, contact, notes")
          .eq("organization_id", currentOrgId)
          .maybeSingle(),
        quotaFn({ data: { organizationId: currentOrgId } }).catch(() => null),
      ]);
      if (cancelled) return;
      setRows(baseRows(!!org.data?.wellness_enabled, (sponsors.count ?? 0) > 0));
      if (prof.data) {
        const c = (prof.data.contact ?? {}) as Record<string, string>;
        setProfile({
          founded_year: prof.data.founded_year ? String(prof.data.founded_year) : "",
          region: prof.data.region ?? "",
          audience: prof.data.audience ?? "",
          tone: prof.data.tone ?? "",
          primary_goal: prof.data.primary_goal ?? "",
          programs: (prof.data.programs ?? []).join(", "),
          phone: c["phone"] ?? "",
          email: c["email"] ?? "",
          address: c["address"] ?? "",
          notes: prof.data.notes ?? "",
        });
      }
      if (q) {
        setQuota({
          used: q.used,
          limit: q.limit,
          remaining: q.remaining,
          purchased: q.purchased,
          period: q.period,
          resetsOn: q.resetsOn,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrgId, quotaFn]);


  const selected = useMemo(() => rows.filter((r) => r.checked), [rows]);
  const setP = (k: keyof typeof PROFILE_EMPTY, v: string) =>
    setProfile((p) => ({ ...p, [k]: v }));

  const toggle = (key: string) =>
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        if (!r.checked && rs.filter((x) => x.checked).length >= 8) {
          toast.error("You can generate up to 8 pages at once");
          return r;
        }
        return { ...r, checked: !r.checked };
      }),
    );

  const start = async () => {
    if (!currentOrgId) return;
    setRunning(true);
    setFatal(null);
    setResults(null);
    const initial: Record<string, RowStatus> = {};
    selected.forEach((r, i) => (initial[r.key] = i === 0 ? "running" : "pending"));
    setStatuses(initial);
    setStep(3);

    const year = profile.founded_year.trim() ? Number(profile.founded_year.trim()) : null;
    const contact: Record<string, string> = {};
    if (profile.phone.trim()) contact["phone"] = profile.phone.trim();
    if (profile.email.trim()) contact["email"] = profile.email.trim();
    if (profile.address.trim()) contact["address"] = profile.address.trim();

    try {
      const res = await runGenerate({
        data: {
          organizationId: currentOrgId,
          profile: {
            founded_year: year && Number.isInteger(year) ? year : null,
            region: profile.region.trim() || null,
            audience: (profile.audience || null) as never,
            tone: (profile.tone || null) as never,
            primary_goal: profile.primary_goal.trim() || null,
            programs: profile.programs
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            contact,
            notes: profile.notes.trim() || null,
          },
          pages: selected.map((r) => ({
            key: r.key,
            title: r.title,
            mode: r.mode,
            ...(r.templateName ? { templateName: r.templateName } : {}),
            ...(r.brief.trim() ? { brief: r.brief.trim() } : {}),
            ...(r.moduleTarget ? { moduleTarget: r.moduleTarget } : {}),
          })),
        },
      });
      const next: Record<string, RowStatus> = {};
      (res.results as Result[]).forEach((r) => (next[r.key] = r.error ? "error" : "done"));
      setStatuses(next);
      setResults(res.results as Result[]);
      setQuota((q) => ({ ...q, used: res.used, limit: res.limit, remaining: res.remaining }));

      const previewEntries = await Promise.all(

        (res.results as Result[])
          .filter((r) => r.pageId)
          .map(async (r) => {
            try {
              const p = await pageFn({ data: { pageId: r.pageId as string } });
              return [r.key, { title: (p.page as { title: string }).title, sections: p.sections }] as const;
            } catch {
              return null;
            }
          }),
      );
      setPreviews(Object.fromEntries(previewEntries.filter(Boolean) as never));
    } catch (e) {
      setFatal(e instanceof Error ? e.message : "Generation failed");
      setStatuses((s) => {
        const n = { ...s };
        Object.keys(n).forEach((k) => (n[k] = n[k] === "done" ? "done" : "error"));
        return n;
      });
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!currentOrgId) return <p className="text-sm text-muted-foreground">Select an organization to begin.</p>;
  if (!isOrgAdmin) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Organization admins only</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask an organization admin to run the site builder. You can still create pages one at a time.
        </p>
        <Link to="/app/website/pages/new" className="mt-4 inline-block text-sm text-primary hover:underline">
          Create a single page →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h2 className="font-serif text-xl font-semibold text-foreground">Build your whole site with AI</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Answer a few questions, get a complete draft site.
        </p>
        <ol className="mt-4 flex flex-wrap gap-2 text-xs">
          {["About your organization", "Your pages", "Review & generate", "Generating"].map((label, i) => (
            <li
              key={label}
              className={`rounded-full border px-3 py-1 ${
                i === step
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>
      </header>

      {step === 0 && (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Founded year">
              <Input
                inputMode="numeric"
                placeholder="1897"
                value={profile.founded_year}
                onChange={(e) => setP("founded_year", e.target.value)}
              />
            </Field>
            <Field label="Region served">
              <Input
                placeholder="Jacksonville, Florida"
                value={profile.region}
                onChange={(e) => setP("region", e.target.value)}
              />
            </Field>
            <Field label="Audience">
              <Select value={profile.audience || undefined} onValueChange={(v) => setP("audience", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="members">Members</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tone">
              <Select value={profile.tone || undefined} onValueChange={(v) => setP("tone", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                  <SelectItem value="modern">Modern</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Primary goal">
            <Input
              maxLength={200}
              placeholder="Grow membership"
              value={profile.primary_goal}
              onChange={(e) => setP("primary_goal", e.target.value)}
            />
          </Field>
          <Field label="Programs (comma separated)">
            <Input
              placeholder="mentorship, CLE, wellness"
              value={profile.programs}
              onChange={(e) => setP("programs", e.target.value)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Phone">
              <Input value={profile.phone} onChange={(e) => setP("phone", e.target.value)} />
            </Field>
            <Field label="Email">
              <Input value={profile.email} onChange={(e) => setP("email", e.target.value)} />
            </Field>
            <Field label="Address">
              <Input value={profile.address} onChange={(e) => setP("address", e.target.value)} />
            </Field>
          </div>
          <Field label="Anything else the AI should know">
            <Textarea
              rows={3}
              maxLength={1000}
              value={profile.notes}
              onChange={(e) => setP("notes", e.target.value)}
            />
          </Field>
          <div className="flex justify-end">
            <Button onClick={() => setStep(1)}>Next</Button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-3 rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">
            {selected.length} of 8 pages selected. Edit each brief to steer the draft.
          </p>
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.key} className="flex gap-3 py-3">
                <Checkbox
                  className="mt-1"
                  checked={r.checked}
                  onCheckedChange={() => toggle(r.key)}
                  aria-label={r.title}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{r.title}</span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                      {r.mode === "template"
                        ? r.templateName
                        : r.mode === "module_intro"
                          ? "Links to live module"
                          : "Custom brief"}
                    </span>
                    {r.optional && <span className="text-[10px] text-muted-foreground">optional</span>}
                  </div>
                  <Input
                    className="mt-2"
                    maxLength={200}
                    disabled={!r.checked}
                    value={r.brief}
                    onChange={(e) =>
                      setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, brief: e.target.value } : x)))
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button disabled={selected.length === 0} onClick={() => setStep(2)}>
              Next
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <ol className="space-y-1 text-sm text-foreground">
            {selected.map((r, i) => (
              <li key={r.key}>
                {i + 1}. {r.title}
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted-foreground">
            This will use {selected.length} of your {quota.remaining} remaining generations this month (
            {quota.used} of {quota.limit} used).
          </p>
          {selected.length > quota.remaining && (
            <p className="text-sm text-destructive">
              Not enough generations remaining. Remove pages or wait for the monthly reset.
            </p>
          )}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button disabled={running || selected.length > quota.remaining} onClick={start}>
              Generate my site
            </Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground">
              {running ? "Generating your site…" : "Generation complete"}
            </h3>
            <ul className="mt-3 space-y-2">
              {selected.map((r) => {
                const st = statuses[r.key] ?? "pending";
                const res = results?.find((x) => x.key === r.key);
                return (
                  <li key={r.key} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 w-5 shrink-0 text-center">
                      {st === "done" ? "✓" : st === "error" ? "✕" : st === "running" ? "⏳" : "·"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-foreground">{r.title}</p>
                      {res?.error && (
                        <p className="text-xs text-destructive">
                          {res.error} — try again from “Create page with AI”.
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {fatal && <p className="mt-3 text-sm text-destructive">{fatal}</p>}
          </div>

          {results && results.some((r) => r.pageId) && (
            <div className="space-y-3">
              <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
                All drafts — publish each page when it's ready.
              </div>
              <h3 className="text-sm font-semibold text-foreground">Your site draft</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results
                  .filter((r) => r.pageId)
                  .map((r) => (
                    <Link
                      key={r.key}
                      to="/app/website/pages/$pageId"
                      params={{ pageId: r.pageId as string }}
                      className="rounded-xl border border-border bg-card p-3 transition hover:border-primary"
                    >
                      <TemplateMiniPreview sections={previews[r.key]?.sections ?? []} />
                      <p className="mt-2 truncate text-sm font-medium text-foreground">
                        {previews[r.key]?.title ?? selected.find((s) => s.key === r.key)?.title ?? r.key}
                      </p>
                      <p className="text-xs text-muted-foreground">/{r.slug} · Draft</p>
                    </Link>
                  ))}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => navigate({ to: "/app/website/pages" as never })}>
                  Go to Pages
                </Button>
                <Button variant="outline" onClick={() => navigate({ to: "/app/website/settings" as never })}>
                  Review navigation order
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
