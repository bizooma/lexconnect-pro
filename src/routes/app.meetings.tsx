import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MEETINGS, ATTORNEYS, findById } from "@/lib/mock-data";
import { Avatar } from "@/components/avatar";

export const Route = createFileRoute("/app/meetings")({
  component: Meetings,
});

function Meetings() {
  const [scheduling, setScheduling] = useState(false);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-foreground lg:text-3xl">Meetings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Coffees, video calls, and check-ins with your matches.</p>
        </div>
        <button onClick={() => setScheduling(true)} className="shrink-0 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant hover:bg-primary/90">
          + New
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {MEETINGS.map((m) => {
          const a = findById(m.withId);
          return (
            <article key={m.id} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card lg:p-5">
              <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-navy text-primary-foreground">
                <span className="text-[10px] uppercase tracking-wider text-gold">{m.date.split(",")[0]}</span>
                <span className="font-serif text-lg font-semibold leading-none">{m.date.split(" ")[2]}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{m.title}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Avatar initials={a.initials} size={20} />
                  <span className="truncate">{a.name} · {m.time}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="rounded-full bg-accent px-2.5 py-1 text-[10px] font-medium text-accent-foreground">{m.link}</span>
                <button className="text-xs font-medium text-primary hover:underline">Open notes</button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Calendar integrations</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {["Google Calendar", "Outlook Calendar"].map((c) => (
            <button key={c} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground hover:border-primary/40">
              {c}
              <span className="text-xs text-muted-foreground">Connect</span>
            </button>
          ))}
        </div>
      </div>

      {scheduling && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-primary/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setScheduling(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-t-2xl bg-card shadow-elegant sm:rounded-2xl">
            <div className="border-b border-border px-5 py-4">
              <h3 className="font-serif text-lg font-semibold text-foreground">Schedule a meeting</h3>
            </div>
            <div className="space-y-4 p-5">
              <Field label="With">
                <select className="block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none ring-ring/30 focus:ring-2">
                  {ATTORNEYS.map((a) => <option key={a.id}>{a.name}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date"><input type="date" className="block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none ring-ring/30 focus:ring-2" /></Field>
                <Field label="Time"><input type="time" defaultValue="10:30" className="block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none ring-ring/30 focus:ring-2" /></Field>
              </div>
              <Field label="Where">
                <div className="flex gap-2">
                  {["Zoom", "Google Meet", "In person"].map((o) => (
                    <button key={o} className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:border-primary/40">{o}</button>
                  ))}
                </div>
              </Field>
            </div>
            <div className="flex justify-end gap-2 border-t border-border bg-background/50 px-5 py-3">
              <button onClick={() => setScheduling(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={() => setScheduling(false)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-elegant hover:bg-primary/90">Send invite</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
