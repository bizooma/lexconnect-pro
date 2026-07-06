import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { listOrgCourses, createCourse, deleteCourse } from "@/lib/ce.functions";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { toast } from "sonner";

export const Route = createFileRoute("/app/ce/admin/")({
  component: CoursesAdmin,
});

function CoursesAdmin() {
  const { currentOrgId } = useCurrentOrg();
  const list = useServerFn(listOrgCourses);
  const create = useServerFn(createCourse);
  const del = useServerFn(deleteCourse);
  const [courses, setCourses] = useState<any[] | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = () => currentOrgId && list({ data: { orgId: currentOrgId } }).then(setCourses);
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [currentOrgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrgId || !newTitle.trim()) return;
    setBusy(true);
    try {
      await create({ data: { orgId: currentOrgId, title: newTitle.trim() } });
      setNewTitle("");
      reload();
      toast.success("Course created");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this course and all lessons, quizzes, and results?")) return;
    await del({ data: { courseId: id } });
    reload();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="flex gap-2 rounded-2xl border border-border bg-card p-4">
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New course title"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          Create course
        </button>
      </form>

      {!courses ? <p className="text-sm text-muted-foreground">Loading…</p> :
       courses.length === 0 ? <p className="text-sm text-muted-foreground">No courses yet.</p> : (
        <div className="space-y-2">
          {courses.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex-1 min-w-0">
                <p className="truncate font-semibold text-foreground">{c.title}</p>
                <p className="text-xs text-muted-foreground">
                  {c.status} · {Number(c.credit_hours || 0).toFixed(1)}h · Updated {new Date(c.updated_at).toLocaleDateString()}
                </p>
              </div>
              <Link to="/app/ce/admin/course/$courseId" params={{ courseId: c.id }}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent">
                Edit
              </Link>
              <button onClick={() => handleDelete(c.id)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
