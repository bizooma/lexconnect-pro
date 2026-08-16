import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Question = { id: string; text: string; scale: "likert5" };

type Survey = {
  id: string;
  title: string;
  questions: Question[];
  opens_at: string;
  closes_at: string | null;
  created_at: string;
};

type QuestionResult = { id: string; counts: number[]; mean: number };
type Results = { responses: number; minimum: number; results: QuestionResult[] | null };

const DEFAULT_QUESTIONS: Question[] = [
  { id: "q1", text: "I have felt anxious about my work in the past month.", scale: "likert5" },
  {
    id: "q2",
    text: "I feel mentally or physically exhausted at the end of most workdays.",
    scale: "likert5",
  },
  {
    id: "q3",
    text: "My workload regularly takes time away from family, friends, or rest.",
    scale: "likert5",
  },
  {
    id: "q4",
    text: "I feel connected to colleagues I could turn to for support.",
    scale: "likert5",
  },
  { id: "q5", text: "I know where to find help if I needed it.", scale: "likert5" },
  { id: "q6", text: "Overall, my current well-being is good.", scale: "likert5" },
];

const BENCHMARKS: Record<string, string> = {
  q1: "ALM 2025 national survey: 68.7% report anxiety",
  q2: "Florida Bar survey: 62% feel overwhelmed",
  q3: "ALM 2025: ~73% say work takes time from family weekly+",
};

const MAX_QUESTIONS = 10;

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};

const statusOf = (s: Survey): "Open" | "Closed" | "Scheduled" => {
  const now = Date.now();
  if (new Date(s.opens_at).getTime() > now) return "Scheduled";
  if (s.closes_at && new Date(s.closes_at).getTime() < now) return "Closed";
  return "Open";
};

type Draft = {
  id?: string;
  title: string;
  questions: Question[];
  opens_at: string;
  closes_at: string;
  locked: boolean;
};

const newDraft = (): Draft => ({
  title: "Quarterly Well-Being Check-In",
  questions: DEFAULT_QUESTIONS.map((q) => ({ ...q })),
  opens_at: toLocalInput(new Date().toISOString()),
  closes_at: toLocalInput(new Date(Date.now() + 14 * 86400000).toISOString()),
  locked: false,
});

export function PulseSurveys({ orgId }: { orgId: string }) {
  const { user } = useAuth();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [resultsBySurvey, setResultsBySurvey] = useState<Record<string, Results>>({});
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [openResults, setOpenResults] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data, error }, memberRes] = await Promise.all([
      supabase
        .from("wellness_surveys")
        .select("id, title, questions, opens_at, closes_at, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "active"),
    ]);
    if (error) {
      setLoading(false);
      toast.error("Could not load surveys", { description: error.message });
      return;
    }
    setMemberCount(memberRes.count ?? null);
    const list = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: r["id"] as string,
      title: r["title"] as string,
      questions: (Array.isArray(r["questions"]) ? r["questions"] : []) as Question[],
      opens_at: r["opens_at"] as string,
      closes_at: (r["closes_at"] as string | null) ?? null,
      created_at: r["created_at"] as string,
    }));
    setSurveys(list);

    const entries = await Promise.all(
      list.map(async (s) => {
        const { data: res } = await supabase.rpc("get_wellness_results", { _survey_id: s.id });
        return [s.id, (res as unknown as Results) ?? null] as const;
      }),
    );
    setResultsBySurvey(
      Object.fromEntries(entries.filter(([, v]) => v !== null)) as Record<string, Results>,
    );
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (s: Survey) => {
    const responses = resultsBySurvey[s.id]?.responses ?? 0;
    setDraft({
      id: s.id,
      title: s.title,
      questions: s.questions.map((q) => ({ ...q })),
      opens_at: toLocalInput(s.opens_at),
      closes_at: s.closes_at ? toLocalInput(s.closes_at) : "",
      locked: responses > 0,
    });
  };

  const save = async () => {
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) return toast.error("Title is required");
    if (title.length > 120) return toast.error("Title must be 120 characters or fewer");
    const questions = draft.questions
      .map((q, i) => ({ id: q.id || `q${i + 1}`, text: q.text.trim(), scale: "likert5" as const }))
      .filter((q) => q.text.length > 0);
    if (!draft.locked && questions.length === 0) return toast.error("Add at least one question");
    if (questions.length > MAX_QUESTIONS)
      return toast.error(`Maximum ${MAX_QUESTIONS} questions`);
    if (!draft.opens_at) return toast.error("Opens at is required");

    setBusy(true);
    if (draft.id) {
      const patch: Record<string, unknown> = {
        title,
        closes_at: draft.closes_at ? new Date(draft.closes_at).toISOString() : null,
      };
      if (!draft.locked) {
        patch["questions"] = questions;
        patch["opens_at"] = new Date(draft.opens_at).toISOString();
      }
      const { error } = await supabase.from("wellness_surveys").update(patch).eq("id", draft.id);
      setBusy(false);
      if (error) return toast.error("Save failed", { description: error.message });
    } else {
      const { error } = await supabase.from("wellness_surveys").insert({
        organization_id: orgId,
        created_by: user?.id ?? "",
        title,
        questions,
        opens_at: new Date(draft.opens_at).toISOString(),
        closes_at: draft.closes_at ? new Date(draft.closes_at).toISOString() : null,
      });
      setBusy(false);
      if (error) return toast.error("Save failed", { description: error.message });
    }
    setDraft(null);
    toast.success("Survey saved");
    void load();
  };

  const closeNow = async (s: Survey) => {
    const { error } = await supabase
      .from("wellness_surveys")
      .update({ closes_at: new Date().toISOString() })
      .eq("id", s.id);
    if (error) return toast.error("Could not close survey", { description: error.message });
    toast.success("Survey closed");
    void load();
  };

  const remove = async (s: Survey) => {
    if (!confirm("Delete this survey and its anonymous responses?")) return;
    const { error } = await supabase.from("wellness_surveys").delete().eq("id", s.id);
    if (error) return toast.error("Delete failed", { description: error.message });
    toast.success("Survey deleted");
    void load();
  };

  const trend = useMemo(() => {
    const unlocked = surveys
      .slice()
      .reverse()
      .filter((s) => resultsBySurvey[s.id]?.results);
    if (unlocked.length < 2) return null;
    const qids = Array.from(
      new Set(unlocked.flatMap((s) => resultsBySurvey[s.id]!.results!.map((r) => r.id))),
    );
    return {
      surveys: unlocked,
      series: qids.map((qid) => ({
        id: qid,
        points: unlocked.map(
          (s) => resultsBySurvey[s.id]!.results!.find((r) => r.id === qid)?.mean ?? 0,
        ),
      })),
    };
  }, [surveys, resultsBySurvey]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-xl">
            <h2 className="font-serif text-lg font-semibold text-foreground">Pulse surveys</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Responses are anonymous by design. LexGuild stores no link between a member and
              their answers, and never shows who has responded.
            </p>
          </div>
          <Button onClick={() => setDraft(newDraft())} disabled={busy}>
            New pulse survey
          </Button>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : surveys.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No pulse surveys yet. Create one to take your bar's temperature.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {surveys.map((s) => {
              const st = statusOf(s);
              const res = resultsBySurvey[s.id];
              return (
                <li key={s.id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{s.title}</p>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          {st}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {s.questions.length} questions · opens{" "}
                        {new Date(s.opens_at).toLocaleDateString()}
                        {s.closes_at
                          ? ` · closes ${new Date(s.closes_at).toLocaleDateString()}`
                          : " · no close date"}{" "}
                        · {res?.responses ?? 0} responses
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setOpenResults(openResults === s.id ? null : s.id)}
                      >
                        {openResults === s.id ? "Hide results" : "Results"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => startEdit(s)}>
                        Edit
                      </Button>
                      {st === "Open" && (
                        <Button size="sm" variant="ghost" onClick={() => void closeNow(s)}>
                          Close now
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => void remove(s)}>
                        Delete
                      </Button>
                    </div>
                  </div>

                  {openResults === s.id && (
                    <ResultsView
                      survey={s}
                      results={res}
                      memberCount={memberCount}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {trend && (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="font-serif text-lg font-semibold text-foreground">Trend</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Mean score per question across surveys with unlocked results (oldest → newest).
          </p>
          <ul className="mt-4 space-y-3">
            {trend.series.map((serie) => (
              <li key={serie.id} className="flex items-center gap-3">
                <span className="w-10 shrink-0 text-xs font-medium text-muted-foreground">
                  {serie.id}
                </span>
                <Spark points={serie.points} />
                <span className="shrink-0 text-xs text-muted-foreground">
                  {serie.points.map((p) => p.toFixed(2)).join(" → ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {draft && (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="font-serif text-lg font-semibold text-foreground">
            {draft.id ? "Edit pulse survey" : "New pulse survey"}
          </h2>
          <div className="mt-4 space-y-4">
            <label className="block">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Opens at
                </span>
                <Input
                  type="datetime-local"
                  className="mt-1.5"
                  disabled={draft.locked}
                  value={draft.opens_at}
                  onChange={(e) => setDraft({ ...draft, opens_at: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Closes at
                </span>
                <Input
                  type="datetime-local"
                  className="mt-1.5"
                  value={draft.closes_at}
                  onChange={(e) => setDraft({ ...draft, closes_at: e.target.value })}
                />
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Questions (5-point agree scale)
                </span>
                {!draft.locked && draft.questions.length < MAX_QUESTIONS && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        questions: [
                          ...draft.questions,
                          {
                            id: `q${draft.questions.length + 1}`,
                            text: "",
                            scale: "likert5",
                          },
                        ],
                      })
                    }
                  >
                    Add question
                  </Button>
                )}
              </div>
              {draft.locked && (
                <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Questions lock after the first response to protect result integrity.
                </p>
              )}
              <ul className="mt-3 space-y-2">
                {draft.questions.map((q, i) => (
                  <li key={q.id} className="flex items-center gap-2">
                    <span className="w-8 shrink-0 text-xs text-muted-foreground">{q.id}</span>
                    <Input
                      value={q.text}
                      disabled={draft.locked}
                      onChange={(e) => {
                        const next = draft.questions.slice();
                        next[i] = { ...q, text: e.target.value };
                        setDraft({ ...draft, questions: next });
                      }}
                    />
                    {!draft.locked && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            questions: draft.questions.filter((_, j) => j !== i),
                          })
                        }
                      >
                        Remove
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function Spark({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 120;
  const h = 28;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((Math.min(Math.max(p, 1), 5) - 1) / 4) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0 text-primary" aria-hidden>
      <path d={path} fill="none" stroke="currentColor" strokeWidth={2} />
    </svg>
  );
}

function ResultsView({
  survey,
  results,
  memberCount,
}: {
  survey: Survey;
  results: Results | undefined;
  memberCount: number | null;
}) {
  if (!results) {
    return <p className="mt-4 text-sm text-muted-foreground">Loading results…</p>;
  }
  const rate =
    memberCount && memberCount > 0
      ? Math.round((results.responses / memberCount) * 100)
      : null;

  if (!results.results) {
    return (
      <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
        <p className="text-sm text-foreground">
          {results.responses} of {results.minimum} responses needed before results unlock.
          Individual responses are never shown.
        </p>
        {rate !== null && (
          <p className="mt-1 text-xs text-muted-foreground">
            Response rate: {rate}% of {memberCount} active members
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-5 rounded-xl border border-border bg-muted/30 p-4">
      <p className="text-xs text-muted-foreground">
        {results.responses} anonymous responses
        {rate !== null ? ` · response rate ${rate}% of ${memberCount} active members` : ""}
      </p>
      {results.results.map((r) => {
        const total = r.counts.reduce((a, b) => a + b, 0) || 1;
        const agree = Math.round(((r.counts[3] + r.counts[4]) / total) * 100);
        const text = survey.questions.find((q) => q.id === r.id)?.text ?? r.id;
        return (
          <div key={r.id}>
            <p className="text-sm font-medium text-foreground">{text}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Mean {Number(r.mean).toFixed(2)} · {agree}% agree (4–5)
            </p>
            <ul className="mt-2 space-y-1">
              {r.counts.map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-3 text-[11px] text-muted-foreground">{i + 1}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(c / total) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-[11px] text-muted-foreground">{c}</span>
                </li>
              ))}
            </ul>
            {BENCHMARKS[r.id] && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {BENCHMARKS[r.id]} — directional comparison; different instruments.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
