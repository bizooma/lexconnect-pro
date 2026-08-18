import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const DIMENSIONS = [
  "physical_activity",
  "stress_management",
  "sleep",
  "nutrition",
  "social_connection",
  "career_satisfaction",
  "mindfulness",
  "community_service",
  "work_life_boundaries",
  "professional_development",
] as const;

type Dimension = (typeof DIMENSIONS)[number];
type Kind = "cumulative" | "daily_checkin" | "pledge";

const labelOf = (d: string) => d.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const KIND_LABEL: Record<Kind, string> = {
  cumulative: "Cumulative total",
  daily_checkin: "Daily check-in",
  pledge: "Pledge",
};

type Challenge = {
  id: string;
  title: string;
  description: string | null;
  dimensions: string[];
  kind: string;
  goal_value: number | null;
  unit: string | null;
  template_key: string | null;
  starts_on: string;
  ends_on: string;
  status: string;
};

type Stats = { participants: number; community_total: number };

type Template = {
  key: string;
  title: string;
  description: string;
  kind: Kind;
  goal_value: number | null;
  unit: string | null;
  dimensions: Dimension[];
};

const TEMPLATES: Template[] = [
  {
    key: "walking",
    title: "Walking Challenge",
    description: "Walk 100,000 steps this month. Log your steps daily — every step counts.",
    kind: "cumulative",
    goal_value: 100000,
    unit: "steps",
    dimensions: ["physical_activity"],
  },
  {
    key: "local_race",
    title: "Local Race Challenge",
    description: "Train for and finish a local race with your colleagues. Any distance counts.",
    kind: "pledge",
    goal_value: null,
    unit: null,
    dimensions: ["physical_activity", "social_connection"],
  },
  {
    key: "better_sleep",
    title: "30 Days of Better Sleep",
    description:
      "Check in each day you followed your wind-down routine. No sleep tracking — just the habit.",
    kind: "daily_checkin",
    goal_value: 30,
    unit: "check-ins",
    dimensions: ["sleep"],
  },
  {
    key: "hydration",
    title: "Hydration Challenge",
    description: "Check in each day you hit your hydration goal.",
    kind: "daily_checkin",
    goal_value: 21,
    unit: "check-ins",
    dimensions: ["nutrition"],
  },
  {
    key: "mindful_minutes",
    title: "Mindful Minutes",
    description: "A few quiet minutes a day. Check in each day you took them.",
    kind: "daily_checkin",
    goal_value: 20,
    unit: "check-ins",
    dimensions: ["mindfulness", "stress_management"],
  },
  {
    key: "no_email_sunday",
    title: "No-Email Sunday",
    description: "Four Sundays without work email. Your inbox will survive.",
    kind: "daily_checkin",
    goal_value: 4,
    unit: "Sundays",
    dimensions: ["work_life_boundaries"],
  },
  {
    key: "volunteer",
    title: "Volunteer Challenge",
    description: "Complete a volunteer or pro bono activity this month.",
    kind: "pledge",
    goal_value: null,
    unit: null,
    dimensions: ["community_service"],
  },
  {
    key: "meet_5_members",
    title: "Meet 5 Members",
    description:
      "Introduce yourself to five members you haven't met. Coffee, court hallway, or a portal message all count.",
    kind: "cumulative",
    goal_value: 5,
    unit: "members",
    dimensions: ["social_connection"],
  },
];

const toDateInput = (d: Date) => {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
};

const nextMonday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const delta = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + delta);
  return d;
};

const defaultDates = () => {
  const start = nextMonday();
  const end = new Date(start.getTime() + 30 * 86400000);
  return { starts_on: toDateInput(start), ends_on: toDateInput(end) };
};

type Draft = {
  id?: string;
  title: string;
  description: string;
  kind: Kind;
  goal_value: string;
  unit: string;
  dimensions: string[];
  starts_on: string;
  ends_on: string;
  template_key: string | null;
  originalGoal?: number | null;
  started?: boolean;
};

const draftFromTemplate = (t: Template): Draft => ({
  title: t.title,
  description: t.description,
  kind: t.kind,
  goal_value: t.goal_value ? String(t.goal_value) : "",
  unit: t.unit ?? "",
  dimensions: [...t.dimensions],
  template_key: t.key,
  ...defaultDates(),
});

const emptyDraft = (): Draft => ({
  title: "",
  description: "",
  kind: "daily_checkin",
  goal_value: "",
  unit: "check-ins",
  dimensions: [],
  template_key: null,
  ...defaultDates(),
});

export function ChallengesAdmin({ orgId }: { orgId: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Challenge[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [interests, setInterests] = useState<{
    members: number;
    minimum: number;
    aggregates: { dimension: string; count: number }[] | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("wellness_challenges")
      .select(
        "id, title, description, dimensions, kind, goal_value, unit, template_key, starts_on, ends_on, status",
      )
      .eq("organization_id", orgId)
      .order("starts_on", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error("Could not load challenges", { description: error.message });
      return;
    }
    const list = (data ?? []) as Challenge[];
    setRows(list);

    const entries = await Promise.all(
      list.map(async (c) => {
        const { data: s } = await supabase.rpc("get_challenge_stats", { _challenge_id: c.id });
        return [c.id, (s as unknown as Stats) ?? { participants: 0, community_total: 0 }] as const;
      }),
    );
    setStats(Object.fromEntries(entries));
  }, [orgId]);

  const loadInterests = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_wellness_interest_aggregates", { _org: orgId });
    if (error) return;
    setInterests(data as unknown as typeof interests);
  }, [orgId]);

  useEffect(() => {
    void load();
    void loadInterests();
  }, [load, loadInterests]);

  const { active, archived } = useMemo(() => {
    const a: Challenge[] = [];
    const b: Challenge[] = [];
    for (const r of rows) (r.status === "archived" ? b : a).push(r);
    return { active: a, archived: b };
  }, [rows]);

  const toggleDim = (d: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      dimensions: draft.dimensions.includes(d)
        ? draft.dimensions.filter((x) => x !== d)
        : [...draft.dimensions, d],
    });
  };

  const onSave = async () => {
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) return toast.error("Title is required");
    if (!draft.starts_on || !draft.ends_on) return toast.error("Start and end dates are required");
    if (draft.ends_on < draft.starts_on) return toast.error("End date must be after the start date");
    if (draft.dimensions.length === 0) return toast.error("Pick at least one focus area");

    const goal = draft.kind === "pledge" ? null : Number(draft.goal_value);
    if (draft.kind !== "pledge" && (!goal || goal <= 0))
      return toast.error("Set a goal greater than zero");

    if (draft.id && draft.started && goal !== (draft.originalGoal ?? null)) {
      const ok = confirm(
        "This challenge has already started. Changing the goal will change progress for everyone who has joined. Continue?",
      );
      if (!ok) return;
    }

    const payload = {
      title,
      description: draft.description.trim() || null,
      kind: draft.kind,
      goal_value: goal,
      unit: draft.kind === "pledge" ? null : draft.unit.trim() || null,
      dimensions: draft.dimensions,
      starts_on: draft.starts_on,
      ends_on: draft.ends_on,
      template_key: draft.template_key,
    };

    setBusy(true);
    const { error } = draft.id
      ? await supabase.from("wellness_challenges").update(payload).eq("id", draft.id)
      : await supabase.from("wellness_challenges").insert({
          ...payload,
          organization_id: orgId,
          created_by: user?.id ?? "",
        });
    setBusy(false);
    if (error) return toast.error("Save failed", { description: error.message });
    setDraft(null);
    toast.success("Challenge saved");
    void load();
  };

  const onArchive = async (c: Challenge) => {
    if (!confirm(`Archive "${c.title}"? Members will no longer see it.`)) return;
    const { error } = await supabase
      .from("wellness_challenges")
      .update({ status: "archived" })
      .eq("id", c.id);
    if (error) return toast.error("Archive failed", { description: error.message });
    toast.success("Archived");
    void load();
  };

  const editDraft = (c: Challenge): Draft => ({
    id: c.id,
    title: c.title,
    description: c.description ?? "",
    kind: (c.kind as Kind) ?? "daily_checkin",
    goal_value: c.goal_value ? String(c.goal_value) : "",
    unit: c.unit ?? "",
    dimensions: [...c.dimensions],
    starts_on: c.starts_on.slice(0, 10),
    ends_on: c.ends_on.slice(0, 10),
    template_key: c.template_key,
    originalGoal: c.goal_value,
    started: new Date(c.starts_on).getTime() <= Date.now(),
  });

  const maxInterest = Math.max(1, ...(interests?.aggregates ?? []).map((a) => a.count));

  const renderRow = (c: Challenge) => {
    const s = stats[c.id];
    return (
      <li key={c.id} className="flex flex-wrap items-start gap-3 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{c.title}</p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {KIND_LABEL[(c.kind as Kind) ?? "pledge"] ?? c.kind}
            </span>
            {c.status === "archived" && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                Archived
              </span>
            )}
          </div>
          {c.description && <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(`${c.starts_on}T00:00:00`).toLocaleDateString()} –{" "}
            {new Date(`${c.ends_on}T00:00:00`).toLocaleDateString()}
            {c.goal_value ? ` · Goal ${c.goal_value.toLocaleString()} ${c.unit ?? ""}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {s ? `${s.participants} participating` : "Loading stats…"}
            {s && c.kind !== "pledge"
              ? ` · ${Number(s.community_total).toLocaleString()} ${c.unit ?? ""} community total`
              : ""}
          </p>
          <p className="mt-1 flex flex-wrap gap-1">
            {c.dimensions.map((d) => (
              <span
                key={d}
                className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {labelOf(d)}
              </span>
            ))}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" onClick={() => setDraft(editDraft(c))}>
            Edit
          </Button>
          {c.status !== "archived" && (
            <Button size="sm" variant="ghost" onClick={() => void onArchive(c)}>
              Archive
            </Button>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      {/* Member interests */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <h2 className="font-serif text-lg font-semibold text-foreground">Member focus areas</h2>
        {!interests ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
        ) : !interests.aggregates ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Aggregate focus areas unlock once 10+ members have set preferences. Individual
            preferences are never visible to staff.
            <span className="mt-1 block text-xs">
              {interests.members} of {interests.minimum} members so far.
            </span>
          </p>
        ) : (
          <>
            <div className="mt-4 space-y-2">
              {interests.aggregates.map((a) => (
                <div key={a.dimension} className="flex items-center gap-3">
                  <span className="w-44 shrink-0 text-xs text-muted-foreground">
                    {labelOf(a.dimension)}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(a.count / maxInterest) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                    {a.count}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Use this to pick your next challenge.
            </p>
          </>
        )}
      </section>

      {/* Templates + create */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-lg font-semibold text-foreground">Start from a template</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTemplates((v) => !v)}>
              {showTemplates ? "Hide templates" : "Show templates"}
            </Button>
            <Button onClick={() => setDraft(emptyDraft())}>Create custom challenge</Button>
          </div>
        </div>
        {showTemplates && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                onClick={() => setDraft(draftFromTemplate(t))}
                className="rounded-xl border border-border p-4 text-left transition hover:border-primary hover:bg-muted/40"
              >
                <p className="text-sm font-semibold text-foreground">{t.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                <p className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {KIND_LABEL[t.kind]}
                  {t.goal_value ? ` · ${t.goal_value.toLocaleString()} ${t.unit}` : ""}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Draft form */}
      {draft && (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="font-serif text-lg font-semibold text-foreground">
            {draft.id ? "Edit challenge" : "New challenge"}
          </h2>
          {draft.id && draft.started && (
            <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              This challenge has already started — changing the goal affects everyone's progress.
            </p>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Title
              </span>
              <Input
                className="mt-1.5"
                maxLength={120}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Description
              </span>
              <textarea
                rows={3}
                maxLength={1000}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none ring-ring/30 focus:ring-2"
              />
            </label>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Type
              </p>
              <Select
                value={draft.kind}
                onValueChange={(v) => setDraft({ ...draft, kind: v as Kind })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cumulative">Cumulative total</SelectItem>
                  <SelectItem value="daily_checkin">Daily check-in</SelectItem>
                  <SelectItem value="pledge">Pledge</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {draft.kind !== "pledge" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Goal
                  </span>
                  <Input
                    className="mt-1.5"
                    type="number"
                    min={1}
                    value={draft.goal_value}
                    onChange={(e) => setDraft({ ...draft, goal_value: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Unit
                  </span>
                  <Input
                    className="mt-1.5"
                    maxLength={40}
                    value={draft.unit}
                    onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                  />
                </label>
              </div>
            )}
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Starts
              </span>
              <Input
                className="mt-1.5"
                type="date"
                value={draft.starts_on}
                onChange={(e) => setDraft({ ...draft, starts_on: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Ends
              </span>
              <Input
                className="mt-1.5"
                type="date"
                value={draft.ends_on}
                onChange={(e) => setDraft({ ...draft, ends_on: e.target.value })}
              />
            </label>
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Focus areas
              </p>
              <div className="flex flex-wrap gap-2">
                {DIMENSIONS.map((d) => {
                  const on = draft.dimensions.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDim(d)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        on
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {labelOf(d)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            <Button onClick={onSave} disabled={busy}>
              {busy ? "Saving…" : "Save challenge"}
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </section>
      )}

      {/* Lists */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <h2 className="font-serif text-lg font-semibold text-foreground">Active challenges</h2>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : active.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No challenges yet. Start from a template above.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border">{active.map(renderRow)}</ul>
        )}
      </section>

      {archived.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="font-serif text-lg font-semibold text-foreground">Archived</h2>
          <ul className="mt-2 divide-y divide-border">{archived.map(renderRow)}</ul>
        </section>
      )}
    </div>
  );
}
