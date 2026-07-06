import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getCourseMember, startEnrollment } from "@/lib/ce.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/app/ce/$courseId")({
  component: CoursePage,
});

function CoursePage() {
  const { courseId } = Route.useParams();
  const fetchCourse = useServerFn(getCourseMember);
  const enroll = useServerFn(startEnrollment);
  const [data, setData] = useState<any>(null);

  const load = () => fetchCourse({ data: { courseId } }).then(setData).catch((e) => toast.error(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [courseId]);

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const { course, lessons, enrollment, progress } = data;
  const pmap = new Map<string, any>((progress ?? []).map((p: any) => [p.lesson_id, p]));

  const handleStart = async () => {
    await enroll({ data: { courseId } });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h1 className="font-serif text-2xl font-semibold text-foreground">{course.title}</h1>
        {course.description && <p className="mt-2 text-sm text-muted-foreground">{course.description}</p>}
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{Number(course.credit_hours || 0).toFixed(1)} CE hours</span>
          <span>·</span>
          <span>{lessons.length} lessons</span>
          {enrollment?.status === "completed" && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600">Completed</span>
          )}
        </div>
        {!enrollment && (
          <button onClick={handleStart}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
            Start course
          </button>
        )}
      </div>

      <div className="space-y-2">
        {lessons.map((l: any, i: number) => {
          const p = pmap.get(l.id);
          const done = l.has_quiz ? !!p?.passed_at : !!p?.video_watched_at;
          const started = !!p?.video_watched_at;
          return (
            <Link key={l.id} to="/app/ce/$courseId/$lessonId" params={{ courseId, lessonId: l.id }}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-primary/40">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? "bg-emerald-500 text-white" : started ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                {done ? "✓" : i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{l.title}</p>
                <p className="text-xs text-muted-foreground">
                  {l.has_quiz ? "Video + quiz" : "Video"}{!l.required && " · Optional"}
                  {p?.best_score_pct != null && ` · Best score ${p.best_score_pct}%`}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
