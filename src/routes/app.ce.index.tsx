import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { listMyCourses } from "@/lib/ce.functions";
import { useCurrentOrg } from "@/hooks/use-current-org";

export const Route = createFileRoute("/app/ce/")({
  component: MyLearning,
});

function MyLearning() {
  const { currentOrgId } = useCurrentOrg();
  const fetchMine = useServerFn(listMyCourses);
  const [data, setData] = useState<{ assigned: any[]; catalog: any[]; totalHours: number } | null>(null);

  useEffect(() => {
    if (!currentOrgId) return;
    fetchMine({ data: { orgId: currentOrgId } }).then(setData).catch(() => setData({ assigned: [], catalog: [], totalHours: 0 }));
  }, [currentOrgId, fetchMine]);

  if (!currentOrgId) return <p className="text-sm text-muted-foreground">Select an organization to view courses.</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">CE credit hours earned</p>
        <p className="mt-2 font-serif text-3xl font-semibold text-foreground">{data.totalHours.toFixed(1)}</p>
      </div>

      <section>
        <h2 className="mb-3 font-serif text-lg font-semibold text-foreground">Assigned to you</h2>
        {data.assigned.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assigned courses yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.assigned.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        )}
      </section>

      {data.catalog.length > 0 && (
        <section>
          <h2 className="mb-3 font-serif text-lg font-semibold text-foreground">Also available</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {data.catalog.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function CourseCard({ course }: { course: any }) {
  const status = course.enrollment?.status;
  return (
    <Link to="/app/ce/$courseId" params={{ courseId: course.id }}
      className="block rounded-2xl border border-border bg-card p-4 shadow-card transition hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-base font-semibold text-foreground">{course.title}</h3>
          {course.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
          )}
        </div>
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {Number(course.credit_hours || 0).toFixed(1)}h
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        {status === "completed" && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600">Completed</span>}
        {status === "in_progress" && <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">In progress</span>}
        {!status && <span className="text-muted-foreground">Not started</span>}
        {course.due_at && <span className="text-muted-foreground">· Due {new Date(course.due_at).toLocaleDateString()}</span>}
      </div>
    </Link>
  );
}
