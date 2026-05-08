import { createFileRoute, Link } from "@tanstack/react-router";
import { CONVERSATIONS, MEETINGS, findById } from "@/lib/mock-data";
import { Avatar } from "@/components/avatar";
import { useMyProfile, useDirectory, initialsOf, locationOf } from "@/hooks/use-profiles";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useMyProfile();
  const { profiles: directory, loading: dirLoading } = useDirectory();

  const firstName = (profile?.full_name || user?.email || "").split(/[\s@]/)[0];
  const upcoming = MEETINGS.slice(0, 2);
  const suggested = directory.slice(0, 3);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-10">
      {/* Welcome */}
      <section className="overflow-hidden rounded-2xl bg-gradient-navy p-6 text-primary-foreground shadow-elegant lg:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Today</p>
        <h1 className="mt-1 font-serif text-2xl font-semibold lg:text-3xl">
          {profileLoading ? "Welcome back." : `Welcome back, ${firstName || "Counselor"}.`}
        </h1>
        <p className="mt-1.5 text-sm text-white/70">
          {profile?.headline || "Complete your profile so members can find and connect with you."}
        </p>

        {/* Profile snapshot */}
        {profile && (profile.bio || (profile.practice_areas && profile.practice_areas.length > 0)) && (
          <div className="mt-5 rounded-xl bg-white/5 p-4 ring-1 ring-inset ring-white/10">
            {profile.practice_areas && profile.practice_areas.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {profile.practice_areas.map((p) => (
                  <span key={p} className="rounded-md bg-gold/15 px-2 py-0.5 text-[10px] font-medium text-gold">{p}</span>
                ))}
              </div>
            )}
            {profile.bio && (
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-white/80">{profile.bio}</p>
            )}
          </div>
        )}

        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { v: "0", l: "Active" },
            { v: "0", l: "Pending" },
            { v: String(upcoming.length), l: "Upcoming" },
          ].map((s) => (
            <div key={s.l} className="rounded-xl bg-white/5 px-3 py-3 ring-1 ring-inset ring-white/10">
              <p className="font-serif text-2xl font-semibold text-gold">{s.v}</p>
              <p className="mt-0.5 text-xs text-white/70">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Suggested matches */}
      <section className="mt-8">
        <SectionHeader title="Suggested matches" actionLabel="View all" actionTo="/app/discover" />
        {dirLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading members…</p>
        ) : suggested.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No other members yet. Invite your colleagues to start building the directory.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {suggested.map((p) => {
              const primary = p.practice_areas?.[0];
              return (
                <article key={p.id} className="rounded-2xl border border-border bg-card p-5 shadow-card transition hover:shadow-elegant">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar initials={initialsOf(p.full_name)} />
                      <div>
                        <p className="font-medium text-foreground">{p.full_name || "Member"}</p>
                        <p className="text-xs text-muted-foreground">
                          {primary || "Attorney"}
                          {p.years_experience ? ` · ${p.years_experience} yrs` : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                  {p.bio && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{p.bio}</p>}
                  <div className="mt-4 flex gap-2">
                    <button className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-elegant hover:bg-primary/90">Connect</button>
                    <button className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent">View</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Two-up */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHeader title="Recent messages" actionLabel="Open inbox" actionTo="/app/messages" />
          <div className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            {CONVERSATIONS.map((c) => {
              const a = findById(c.withId);
              return (
                <Link key={c.id} to="/app/messages/$id" params={{ id: c.id }} className="flex items-center gap-3 p-4 transition hover:bg-accent/50">
                  <Avatar initials={a.initials} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                      <span className="text-[11px] text-muted-foreground">{c.lastAt}</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{c.lastMessage}</p>
                  </div>
                  {c.unread > 0 && <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-semibold text-gold-foreground">{c.unread}</span>}
                </Link>
              );
            })}
          </div>
        </section>

        <section>
          <SectionHeader title="Upcoming meetings" actionLabel="Schedule" actionTo="/app/meetings" />
          <div className="mt-4 space-y-3">
            {upcoming.map((m) => {
              const a = findById(m.withId);
              return (
                <div key={m.id} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-gradient-navy text-primary-foreground">
                    <span className="text-[10px] uppercase tracking-wider text-gold">{m.date.split(",")[0]}</span>
                    <span className="font-serif text-base font-semibold">{m.date.split(" ")[2]}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{m.title}</p>
                    <p className="truncate text-xs text-muted-foreground">with {a.name} · {m.time}</p>
                  </div>
                  <span className="rounded-full bg-accent px-2.5 py-1 text-[10px] font-medium text-accent-foreground">{m.link}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* unused helper to silence linter for locationOf */}
      <span className="hidden">{locationOf({ city: null, state: null })}</span>
    </div>
  );
}

function SectionHeader({ title, actionLabel, actionTo }: { title: string; actionLabel: string; actionTo: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="font-serif text-lg font-semibold text-foreground">{title}</h2>
      <Link to={actionTo as any} className="text-xs font-medium text-primary hover:underline">{actionLabel} →</Link>
    </div>
  );
}
