import { useEffect, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useOrgWellness } from "@/hooks/use-org-wellness";

export const Route = createFileRoute("/app/wellness/pulse/$surveyId")({
  head: () => ({
    meta: [
      { title: "Well-Being check-in — LexGuild" },
      {
        name: "description",
        content: "A short, anonymous well-being pulse check-in for members of your bar association.",
      },
      { property: "og:title", content: "Well-Being check-in — LexGuild" },
      {
        property: "og:description",
        content: "A short, anonymous well-being pulse check-in for your organization.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PulseSurveyPage,
});

type Question = { id: string; text: string; scale?: string };

const SCALE = [
  { value: 1, label: "Strongly disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly agree" },
];

const ANONYMITY_COPY =
  "Your answers are anonymous. LexGuild stores no link between you and your responses. Your organization sees results only in aggregate, and only once at least 10 members have responded.";

function PulseSurveyPage() {
  const { surveyId } = useParams({ from: "/app/wellness/pulse/$surveyId" });
  const { wellness } = useOrgWellness();
  const [survey, setSurvey] = useState<{ id: string; title: string; questions: Question[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("wellness_surveys")
      .select("id, title, questions")
      .eq("id", surveyId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setSurvey(
          data
            ? {
                id: data.id as string,
                title: (data.title as string) ?? "Well-Being check-in",
                questions: (Array.isArray(data.questions) ? data.questions : []) as Question[],
              }
            : null,
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [surveyId]);

  const submit = async () => {
    if (!survey) return;
    const missing = survey.questions.filter((q) => !answers[q.id]);
    if (missing.length > 0) {
      setError("Please answer every question before submitting.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: rpcError } = await supabase.rpc("submit_wellness_response", {
      _survey_id: survey.id,
      _answers: answers,
    });
    setSubmitting(false);
    if (rpcError) {
      const msg = rpcError.message.toLowerCase();
      if (msg.includes("already")) setBlocked("You've already completed this check-in. Thank you.");
      else if (msg.includes("open") || msg.includes("closed") || msg.includes("window"))
        setBlocked("This check-in is closed. Watch for the next one.");
      else if (msg.includes("member")) setBlocked("This check-in isn't available to your account.");
      else setError("Something went wrong submitting your responses. Please try again.");
      return;
    }
    setDone(true);
  };

  const lapName = wellness?.lap_name || "your Lawyer Assistance Program";

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;

  if (!survey) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-serif text-2xl font-semibold text-foreground">Check-in unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">This check-in no longer exists.</p>
        <Link to="/app/wellness" className="mt-4 inline-block text-sm font-medium text-primary underline underline-offset-4">
          Back to Well-Being
        </Link>
      </div>
    );
  }

  if (done || blocked) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-card">
          <h1 className="font-serif text-2xl font-semibold text-foreground">
            {done ? "Thank you" : "Check-in unavailable"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {done ? "Your anonymous response was recorded." : blocked}
          </p>
          {done && (
            <p className="mt-4 text-sm text-foreground">
              If anything in this check-in hit close to home, {lapName} is free and confidential
              {wellness?.lap_phone ? (
                <>
                  {" — "}
                  <a href={`tel:${wellness.lap_phone.replace(/[^\d+]/g, "")}`} className="underline underline-offset-4">
                    {wellness.lap_phone}
                  </a>
                </>
              ) : null}
              .
            </p>
          )}
          <Link
            to="/app/wellness"
            className="mt-6 inline-block rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-primary/40"
          >
            Back to Well-Being
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 lg:py-10">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Anonymous check-in</p>
      <h1 className="font-serif text-2xl font-semibold text-foreground lg:text-3xl">{survey.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">≈2 minutes · Anonymous</p>

      <div className="mt-6 space-y-4">
        {survey.questions.map((q, i) => (
          <fieldset key={q.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <legend className="sr-only">{q.text}</legend>
            <p className="text-sm font-medium text-foreground">
              {i + 1}. {q.text}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-5">
              {SCALE.map((s) => {
                const active = answers[q.id] === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: s.value }))}
                    className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40"
                    }`}
                    aria-pressed={active}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">{ANONYMITY_COPY}</p>

      <Button className="mt-4 w-full sm:w-auto" onClick={() => void submit()} disabled={submitting}>
        {submitting ? "Submitting…" : "Submit"}
      </Button>
    </div>
  );
}
