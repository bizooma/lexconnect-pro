import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ATTORNEYS, PRACTICE_AREAS } from "@/lib/mock-data";
import { Avatar } from "@/components/avatar";

export const Route = createFileRoute("/app/discover")({
  component: Discover,
});

function Discover() {
  const [q, setQ] = useState("");
  const [practice, setPractice] = useState<string | null>(null);
  const [requested, setRequested] = useState<string | null>(null);

  const filtered = ATTORNEYS.filter((a) => {
    if (practice && a.practice !== practice) return false;
    if (q && !(`${a.name} ${a.firm} ${a.bio}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-10">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground lg:text-3xl">Discover</h1>
        <p className="mt-1 text-sm text-muted-foreground">Find mentors and mentees by practice, location, and interests.</p>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3" strokeLinecap="round"/></svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, firm, or interest"
            className="block w-full rounded-lg border border-input bg-card py-2.5 pl-10 pr-3.5 text-sm text-foreground shadow-card outline-none ring-ring/30 focus:ring-2"
          />
        </div>
      </div>

      <div className="mt-3 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0 lg:flex-wrap">
        <FilterChip label="All" active={practice === null} onClick={() => setPractice(null)} />
        {PRACTICE_AREAS.map((p) => (
          <FilterChip key={p} label={p} active={practice === p} onClick={() => setPractice(p)} />
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((a) => (
          <article key={a.id} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-card transition hover:shadow-elegant">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar initials={a.initials} size={44} />
                <div>
                  <p className="font-medium text-foreground">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.firm}</p>
                </div>
              </div>
              <span className="rounded-full bg-gold/15 px-2 py-1 text-[10px] font-semibold text-gold-foreground/80">{a.match}%</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Tag>{a.practice}</Tag>
              <Tag>{a.city}</Tag>
              <Tag>{a.years} yrs</Tag>
            </div>
            <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{a.bio}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {a.interests.slice(0, 2).map((i) => <Tag key={i} subtle>{i}</Tag>)}
            </div>
            <div className="mt-auto pt-4">
              <button
                onClick={() => setRequested(a.id)}
                className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-elegant hover:bg-primary/90"
              >Connect</button>
            </div>
          </article>
        ))}
      </div>

      {requested && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-primary/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setRequested(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-t-2xl bg-card shadow-elegant sm:rounded-2xl">
            <div className="border-b border-border px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Mentorship request</p>
              <h3 className="mt-1 font-serif text-lg font-semibold text-foreground">Reach out to {ATTORNEYS.find(x => x.id === requested)?.name}</h3>
            </div>
            <div className="p-5">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">Short introduction</label>
              <textarea
                rows={5}
                defaultValue="Hi — I'm building a litigation-focused solo practice and your work caught my attention. Would you be open to a 20-minute intro call this month?"
                className="mt-1.5 block w-full rounded-lg border border-input bg-background p-3 text-sm leading-relaxed text-foreground outline-none ring-ring/30 focus:ring-2"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-border bg-background/50 px-5 py-3">
              <button onClick={() => setRequested(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={() => setRequested(null)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-elegant hover:bg-primary/90">Send request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/40"}`}>{label}</button>
  );
}
function Tag({ children, subtle = false }: { children: React.ReactNode; subtle?: boolean }) {
  return <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${subtle ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>{children}</span>;
}
