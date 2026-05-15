import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { listFormSubmissions, deleteFormSubmission } from "@/lib/website.functions";

export const Route = createFileRoute("/app/website/submissions")({
  component: SubmissionsPage,
});

type Row = {
  id: string;
  organization_id: string;
  page_id: string | null;
  section_id: string | null;
  form_kind: "newsletter" | "contact";
  data: Record<string, string>;
  referrer: string | null;
  created_at: string;
};

function SubmissionsPage() {
  const { currentOrgId } = useCurrentOrg();
  const list = useServerFn(listFormSubmissions);
  const del = useServerFn(deleteFormSubmission);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "newsletter" | "contact">("all");

  const refresh = () => {
    if (!currentOrgId) return;
    setLoading(true);
    list({ data: { organizationId: currentOrgId } })
      .then((r) => setRows(r.submissions as Row[]))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, [currentOrgId]);

  const filtered = rows.filter((r) => filter === "all" || r.form_kind === filter);

  const exportCsv = () => {
    if (filtered.length === 0) return;
    const cols = new Set<string>();
    filtered.forEach((r) => Object.keys(r.data ?? {}).forEach((k) => cols.add(k)));
    const headers = ["received_at", "kind", "referrer", ...Array.from(cols)];
    const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const lines = [headers.join(",")];
    filtered.forEach((r) => {
      const values = [
        r.created_at,
        r.form_kind,
        r.referrer ?? "",
        ...Array.from(cols).map((c) => r.data?.[c] ?? ""),
      ];
      lines.push(values.map(escape).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `submissions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Form submissions</h2>
          <p className="text-sm text-muted-foreground">
            Newsletter signups and contact form messages from your published pages.
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      <div className="flex gap-2">
        {(["all", "newsletter", "contact"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              filter === k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {k === "all" ? "All" : k === "newsletter" ? "Newsletter" : "Contact"}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No submissions yet. Newsletter and contact form data from your public pages will appear here.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize text-muted-foreground">
                        {r.form_kind}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                    </div>
                    <dl className="mt-2 grid grid-cols-[120px_1fr] gap-y-1 text-sm">
                      {Object.entries(r.data ?? {}).map(([k, v]) => (
                        <div key={k} className="contents">
                          <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
                          <dd className="break-words text-foreground">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    {r.referrer && (
                      <p className="mt-2 truncate text-xs text-muted-foreground">From: {r.referrer}</p>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm("Delete this submission?")) return;
                      await del({ data: { id: r.id } });
                      toast.success("Deleted");
                      refresh();
                    }}
                    className="text-xs text-destructive hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
