import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getLessonForPlayer, markVideoWatched, submitQuizAttempt } from "@/lib/ce.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/app/ce/$courseId/$lessonId")({
  component: LessonPlayer,
});

function LessonPlayer() {
  const { courseId, lessonId } = Route.useParams();
  const fetchLesson = useServerFn(getLessonForPlayer);
  const watched = useServerFn(markVideoWatched);
  const submit = useServerFn(submitQuizAttempt);
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () => fetchLesson({ data: { lessonId } }).then((d) => { setData(d); setResult(null); setAnswers({}); }).catch((e) => toast.error(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [lessonId]);

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const { lesson, progress, quiz, attemptsUsed } = data;
  const videoWatched = !!progress?.video_watched_at;
  const canRetry = quiz?.settings?.max_attempts == null || attemptsUsed < quiz.settings.max_attempts;

  const toggle = (qid: string, oid: string, multi: boolean) => {
    setAnswers((prev) => {
      const cur = new Set(prev[qid] ?? []);
      if (multi) { cur.has(oid) ? cur.delete(oid) : cur.add(oid); }
      else { cur.clear(); cur.add(oid); }
      return { ...prev, [qid]: Array.from(cur) };
    });
  };

  const handleMarkWatched = async () => {
    await watched({ data: { lessonId, courseId } });
    load();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const r = await submit({ data: { lessonId, courseId, answers } });
      setResult(r);
      if (r.passed) toast.success(`Passed with ${r.scorePct}%`);
      else toast.error(`Scored ${r.scorePct}% — need ${quiz.settings?.passing_score_pct ?? 80}% to pass`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/app/ce/$courseId" params={{ courseId }} className="text-xs text-muted-foreground hover:text-foreground">← Back to course</Link>

      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">{lesson.title}</h1>
        {lesson.description && <p className="mt-2 text-sm text-muted-foreground">{lesson.description}</p>}
      </div>

      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${lesson.youtube_video_id}?rel=0`}
          title={lesson.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      {!videoWatched && (
        <button onClick={handleMarkWatched}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          Mark video as watched
        </button>
      )}
      {videoWatched && !lesson.has_quiz && (
        <p className="text-sm text-emerald-600">✓ Lesson complete</p>
      )}

      {lesson.has_quiz && videoWatched && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold text-foreground">Quiz</h2>
            <p className="text-xs text-muted-foreground">
              Passing: {quiz.settings?.passing_score_pct ?? 80}% ·
              Attempts: {attemptsUsed}{quiz.settings?.max_attempts != null ? ` / ${quiz.settings.max_attempts}` : " (unlimited)"}
            </p>
          </div>

          {result ? (
            <div className="space-y-3">
              <p className={`text-lg font-semibold ${result.passed ? "text-emerald-600" : "text-red-600"}`}>
                {result.passed ? "Passed" : "Failed"} — {result.scorePct}% ({result.correctCount} of {result.total} correct)
              </p>
              {!result.passed && canRetry && (
                <button onClick={load} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
                  Retry quiz
                </button>
              )}
              {!result.passed && !canRetry && (
                <p className="text-sm text-muted-foreground">You've used all your attempts. Contact your admin for reset.</p>
              )}
              {result.passed && (
                <button onClick={() => navigate({ to: "/app/ce/$courseId", params: { courseId } })}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-accent">
                  Back to course
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {quiz.questions.map((q: any, i: number) => (
                <div key={q.id}>
                  <p className="mb-2 text-sm font-semibold text-foreground">
                    {i + 1}. {q.prompt}
                    {q.multi_select && <span className="ml-2 text-xs font-normal text-muted-foreground">(select all that apply)</span>}
                  </p>
                  <div className="space-y-2">
                    {q.ce_quiz_options.map((o: any) => {
                      const checked = (answers[q.id] ?? []).includes(o.id);
                      return (
                        <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${checked ? "border-primary bg-primary/5" : "border-border"}`}>
                          <input
                            type={q.multi_select ? "checkbox" : "radio"}
                            name={q.id}
                            checked={checked}
                            onChange={() => toggle(q.id, o.id, q.multi_select)}
                          />
                          <span>{o.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button onClick={handleSubmit} disabled={submitting || quiz.questions.length === 0}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {submitting ? "Submitting…" : "Submit quiz"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
