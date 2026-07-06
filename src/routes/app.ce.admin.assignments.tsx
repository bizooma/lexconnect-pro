import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { listOrgCourses, listAssignments, assignCourse, unassign, listOrgMembers } from "@/lib/ce.functions";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { toast } from "sonner";

export const Route = createFileRoute("/app/ce/admin/assignments")({
  component: AssignmentsAdmin,
});

const ROLES = ["owner", "admin", "content_editor", "member"] as const;

function AssignmentsAdmin() {
  const { currentOrgId } = useCurrentOrg();
  const listCourses = useServerFn(listOrgCourses);
  const listAssigns = useServerFn(listAssignments);
  const assign = useServerFn(assignCourse);
  const remove = useServerFn(unassign);
  const listMembers = useServerFn(listOrgMembers);

  const [courses, setCourses] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assigneeType, setAssigneeType] = useState<"user" | "role">("user");
  const [assigneeUser, setAssigneeUser] = useState("");
  const [assigneeRole, setAssigneeRole] = useState<typeof ROLES[number]>("member");
  const [dueAt, setDueAt] = useState("");

  useEffect(() => {
    if (!currentOrgId) return;
    Promise.all([
      listCourses({ data: { orgId: currentOrgId } }),
      listMembers({ data: { orgId: currentOrgId } }),
    ]).then(([c, m]) => { setCourses(c); setMembers(m); if (!selectedCourse && c[0]) setSelectedCourse(c[0].id); });
    // eslint-disable-next-line
  }, [currentOrgId]);

  const reload = () => selectedCourse && listAssigns({ data: { courseId: selectedCourse } }).then(setAssignments);
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [selectedCourse]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    try {
      await assign({ data: {
        courseId: selectedCourse,
        assignee_user_id: assigneeType === "user" ? assigneeUser : null,
        assignee_role: assigneeType === "role" ? assigneeRole : null,
        due_at: dueAt || null,
      }});
      setAssigneeUser(""); setDueAt("");
      reload();
      toast.success("Assigned");
    } catch (e: any) { toast.error(e.message); }
  };

  const memberName = (uid: string) => members.find((m) => m.user_id === uid)?.full_name ?? uid.slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Course</label>
        <select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)}
          className="mt-1 block w-full max-w-md rounded-lg border border-border bg-background px-3 py-2 text-sm">
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.status})</option>)}
        </select>
      </div>

      {selectedCourse && (
        <>
          <form onSubmit={handleAssign} className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <p className="text-sm font-semibold">Add assignment</p>
            <div className="flex gap-2 text-sm">
              <label className="flex items-center gap-1">
                <input type="radio" checked={assigneeType === "user"} onChange={() => setAssigneeType("user")} /> Specific member
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" checked={assigneeType === "role"} onChange={() => setAssigneeType("role")} /> All members with role
              </label>
            </div>
            {assigneeType === "user" ? (
              <select required value={assigneeUser} onChange={(e) => setAssigneeUser(e.target.value)}
                className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="">Select member…</option>
                {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name} ({m.org_role})</option>)}
              </select>
            ) : (
              <select value={assigneeRole} onChange={(e) => setAssigneeRole(e.target.value as any)}
                className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            )}
            <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)}
              className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Assign</button>
          </form>

          <div>
            <h3 className="mb-2 font-semibold text-sm">Current assignments</h3>
            {assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">None yet.</p>
            ) : (
              <div className="space-y-2">
                {assignments.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm">
                    <div className="flex-1">
                      <p className="font-medium">
                        {a.assignee_user_id ? memberName(a.assignee_user_id) : `Role: ${a.assignee_role}`}
                      </p>
                      {a.due_at && <p className="text-xs text-muted-foreground">Due {new Date(a.due_at).toLocaleString()}</p>}
                    </div>
                    <button onClick={async () => { await remove({ data: { assignmentId: a.id } }); reload(); }}
                      className="text-xs text-red-600">Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
