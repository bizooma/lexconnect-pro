import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { listOrgCourses, listOrgResults, getMemberTranscript } from "@/lib/ce.functions";
import { useCurrentOrg } from "@/hooks/use-current-org";

export const Route = createFileRoute("/app/ce/admin/results")({
  component: ResultsAdmin,
});

function ResultsAdmin() {
  const { currentOrgId } = useCurrentOrg();
  const listCourses = useServerFn(listOrgCourses);
  const listResults = useServerFn(listOrgResults);
  const getTranscript = useServerFn(getMemberTranscript);

  const [courses, setCourses] = useState<any[]>([]);
  const [filterCourse, setFilterCourse] = useState<string>("");
  const [rows, setRows] = useState<any[]>([]);
  const [drilldown, setDrilldown] = useState<{ userId: string; name: string } | null>(null);
  const [transcript, setTranscript] = useState<any>(null);

  useEffect(() => {
    if (!currentOrgId) return;
    listCourses({ data: { orgId: currentOrgId } }).then(setCourses);
    // eslint-disable-next-line
  }, [currentOrgId]);

  useEffect(() => {
    if (!currentOrgId) return;
    listResults({ data: { orgId: currentOrgId, courseId: filterCourse || null } }).then(setRows);
    // eslint-disable-next-line
  }, [currentOrgId, filterCourse]);

  useEffect(() => {
    if (!drilldown || !currentOrgId) return setTranscript(null);
    getTranscript({ data: { orgId: currentOrgId, userId: drilldown.userId } }).then(setTranscript);
    // eslint-disable-next-line
  }, [drilldown, currentOrgId]);

  const totalCompleted = useMemo(() => rows.filter((r) => r.status === "completed").length, [rows]);
  const totalHours = useMemo(() =>
    rows.filter((r) => r.status === "completed").reduce((s, r) => s + Number(r.ce_courses?.credit_hours ?? 0), 0),
    [rows]);

  const exportCsv = () => {
    const header = ["Member", "Course", "Status", "Credit hours", "Enrolled", "Completed"];
    const csv = [header.join(",")].concat(
      rows.map((r) => [
        JSON.stringify(r.member_name),
        JSON.stringify(r.ce_courses?.title ?? ""),
        r.status,
        r.ce_courses?.credit_hours ?? 0,
        r.enrolled_at ?? "",
        r.completed_at ?? "",
      ].join(","))
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ce-results.csv";
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          <option value="">All courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <button onClick={exportCsv} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-accent">Export CSV</button>
        <div className="ml-auto text-xs text-muted-foreground">
          {rows.length} enrollments · {totalCompleted} completed · {totalHours.toFixed(1)}h earned
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-accent/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Member</th>
              <th className="px-3 py-2 text-left">Course</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Hours</th>
              <th className="px-3 py-2 text-left">Enrolled</th>
              <th className="px-3 py-2 text-left">Completed</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2">{r.member_name}</td>
                <td className="px-3 py-2">{r.ce_courses?.title}</td>
                <td className="px-3 py-2">
                  {r.status === "completed"
                    ? <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">Completed</span>
                    : <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">In progress</span>}
                </td>
                <td className="px-3 py-2">{Number(r.ce_courses?.credit_hours ?? 0).toFixed(1)}</td>
                <td className="px-3 py-2 text-muted-foreground">{new Date(r.enrolled_at).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.completed_at ? new Date(r.completed_at).toLocaleDateString() : "—"}</td>
                <td className="px-3 py-2">
                  <button onClick={() => setDrilldown({ userId: r.user_id, name: r.member_name })}
                    className="text-xs text-primary">Transcript</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">No results yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {drilldown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDrilldown(null)}>
          <div onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold">{drilldown.name} — transcript</h3>
              <button onClick={() => setDrilldown(null)} className="text-sm text-muted-foreground">Close</button>
            </div>
            {!transcript ? <p className="text-sm text-muted-foreground">Loading…</p> : (
              <>
                <section>
                  <h4 className="mb-2 text-sm font-semibold">Enrollments</h4>
                  <ul className="space-y-1 text-sm">
                    {transcript.enrollments.map((e: any) => (
                      <li key={e.id} className="flex justify-between border-b border-border py-1">
                        <span>{e.ce_courses?.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {e.status}{e.completed_at && ` · ${new Date(e.completed_at).toLocaleDateString()}`}
                        </span>
                      </li>
                    ))}
                    {transcript.enrollments.length === 0 && <li className="text-muted-foreground">None</li>}
                  </ul>
                </section>
                <section>
                  <h4 className="mb-2 text-sm font-semibold">Quiz attempts</h4>
                  <ul className="space-y-1 text-sm">
                    {transcript.attempts.map((a: any) => (
                      <li key={a.id} className="flex justify-between border-b border-border py-1">
                        <span>{a.ce_lessons?.ce_courses?.title} — {a.ce_lessons?.title} · #{a.attempt_no}</span>
                        <span className={a.passed ? "text-emerald-600" : "text-red-600"}>{a.score_pct}%</span>
                      </li>
                    ))}
                    {transcript.attempts.length === 0 && <li className="text-muted-foreground">None</li>}
                  </ul>
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
