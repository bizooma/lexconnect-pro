import { createFileRoute, Navigate } from "@tanstack/react-router";
import { ATTORNEYS } from "@/lib/mock-data";
import { Avatar } from "@/components/avatar";
import { useIsAdmin } from "@/hooks/use-is-admin";

export const Route = createFileRoute("/app/admin")({
  component: Admin,
});

function Admin() {
  const { isAdmin, checking } = useIsAdmin();
  if (checking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!isAdmin) {
    return <Navigate to="/app/dashboard" />;
  }

  const stats = [
    { l: "Active mentorships", v: "184", d: "+12 this month" },
    { l: "Messages sent", v: "2,431", d: "Past 30 days" },
    { l: "Monthly engagement", v: "78%", d: "+6% vs. April" },
    { l: "Pending requests", v: "9", d: "Awaiting review" },
  ];
  const top = ["Estate Planning", "Business Litigation", "Solo Practice", "Family Law", "Probate"];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Bar Association Admin</p>
          <h1 className="mt-1 font-serif text-2xl font-semibold text-foreground lg:text-3xl">Program overview</h1>
        </div>
        <button className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant hover:bg-primary/90">
          Send announcement
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.l} className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.l}</p>
            <p className="mt-2 font-serif text-3xl font-semibold text-foreground">{s.v}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.d}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="font-serif text-lg font-semibold text-foreground">Member directory</h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">Role</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Practice</th>
                  <th className="px-4 py-3 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ATTORNEYS.map((a) => (
                  <tr key={a.id} className="transition hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar initials={a.initials} size={32} />
                        <div>
                          <p className="font-medium text-foreground">{a.name}</p>
                          <p className="text-xs text-muted-foreground">{a.firm}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{a.role}</td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{a.practice}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-1 text-[10px] font-medium text-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-foreground">Most active practice areas</h2>
          <div className="mt-3 space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
            {top.map((p, i) => (
              <div key={p}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{p}</span>
                  <span className="text-muted-foreground">{[92, 78, 64, 51, 39][i]}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-gold" style={{ width: `${[100, 85, 70, 55, 42][i]}%` }} />
                </div>
              </div>
            ))}
          </div>

          <h2 className="mt-6 font-serif text-lg font-semibold text-foreground">Pending requests</h2>
          <div className="mt-3 space-y-2">
            {ATTORNEYS.slice(3, 5).map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
                <Avatar initials={a.initials} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                  <p className="truncate text-xs text-muted-foreground">Wants to mentor in {a.practice}</p>
                </div>
                <button className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90">Approve</button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
