import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import { useMyProfile, useDirectory, initialsOf } from "@/hooks/use-profiles";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { scoreMatches, buildActiveLoadMap, type ExistingPair } from "@/lib/matching";

export const Route = createFileRoute("/app/dashboard")({
  component: Dashboard,
});

type Mentorship = {
  id: string;
  mentor_id: string;
  mentee_id: string;
  status: string;
  intro_message: string | null;
  created_at: string;
};

type MeetingRow = {
  id: string;
  title: string;
  scheduled_at: string;
  host_id: string;
  attendee_id: string;
};

function Dashboard() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useMyProfile();
  const { profiles: directory, loading: dirLoading } = useDirectory();
  const [mentorships, setMentorships] = useState<Mentorship[]>([]);
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, { full_name: string | null; avatar_url: string | null }>>({});

  const refresh = async () => {
    if (!user) return;
    const [{ data: m }, { data: mt }] = await Promise.all([
      supabase
        .from("mentorships")
        .select("id,mentor_id,mentee_id,status,intro_message,created_at,requested_by")
        .or(`mentor_id.eq.${user.id},mentee_id.eq.${user.id}`)
        .order("created_at", { ascending: false }),
      supabase
        .from("meetings")
        .select("id,title,scheduled_at,host_id,attendee_id")
        .or(`host_id.eq.${user.id},attendee_id.eq.${user.id}`)
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(3),
    ]);
    const ms = (m as Mentorship[] | null) ?? [];
    setMentorships(ms);
    setMeetings((mt as MeetingRow[] | null) ?? []);
    const ids = new Set<string>();
    ms.forEach((x) => { ids.add(x.mentor_id); ids.add(x.mentee_id); });
    (mt ?? []).forEach((x: any) => { ids.add(x.host_id); ids.add(x.attendee_id); });
    if (ids.size > 0) {
      const { data: p } = await supabase
        .from("profiles")
        .select("user_id,full_name,avatar_url")
        .in("user_id", Array.from(ids));
      const map: typeof profileMap = {};
      (p ?? []).forEach((row: any) => { map[row.user_id] = { full_name: row.full_name, avatar_url: row.avatar_url }; });
      setProfileMap(map);
    }
  };

  useEffect(() => { refresh(); }, [user]);

  const pendingForMe = mentorships.filter((m) => m.status === "pending" && (m as any).requested_by && (m as any).requested_by !== user?.id && (m.mentor_id === user?.id || m.mentee_id === user?.id));
  const myPendingOut = mentorships.filter((m) => m.status === "pending" && (m as any).requested_by === user?.id);
  const active = mentorships.filter((m) => m.status === "active");
  const actionablePendingCount = pendingForMe.length;

  const respond = async (id: string, accept: boolean) => {
    const { error } = await supabase
      .from("mentorships")
      .update({ status: accept ? "active" : "declined" })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(accept ? "Mentorship accepted" : "Request declined");
    refresh();
  };

  const firstName = (profile?.full_name || user?.email || "").split(/[\s@]/)[0];

  const suggested = useMemo(() => {
    if (!profile) return [];
    const pairs: ExistingPair[] = mentorships.map((m) => ({
      mentor_id: m.mentor_id,
      mentee_id: m.mentee_id,
      status: m.status,
    }));
    return scoreMatches({
      viewer: profile as any,
      candidates: directory as any,
      existingPairs: pairs,
      activeLoad: buildActiveLoadMap(pairs),
    }).slice(0, 3);
  }, [profile, directory, mentorships]);

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

        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat v={String(active.length)} l="Active" />
          <Stat v={String(actionablePendingCount)} l="Pending" />
          <Stat v={String(meetings.length)} l="Upcoming" />
        </div>
      </section>

      {/* Mentor inbox */}
      {pendingForMe.length > 0 && (
        <section className="mt-8">
          <SectionHeader title="Mentorship requests" subtitle="People who want to connect with you" />
          <div className="mt-3 space-y-2">
            {pendingForMe.map((req) => {
              const otherId = (req as any).requested_by as string;
              const p = profileMap[otherId];
              return (
                <article key={req.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-start gap-3">
                    <Avatar initials={initialsOf(p?.full_name)} src={p?.avatar_url} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{p?.full_name || "A member"}</p>
                      {req.intro_message && (
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{req.intro_message}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      onClick={() => respond(req.id, false)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >Decline</button>
                    <button
                      onClick={() => respond(req.id, true)}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-elegant hover:bg-primary/90"
                    >Accept</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* My active mentorships */}
      {active.length > 0 && (
        <section className="mt-8">
          <SectionHeader title="Your mentorships" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {active.map((m) => {
              const otherId = m.mentor_id === user?.id ? m.mentee_id : m.mentor_id;
              const role = m.mentor_id === user?.id ? "Your mentee" : "Your mentor";
              const p = profileMap[otherId];
              return (
                <Link key={m.id} to="/app/messages" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card transition hover:shadow-elegant">
                  <Avatar initials={initialsOf(p?.full_name)} src={p?.avatar_url} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{p?.full_name || "Member"}</p>
                    <p className="text-xs text-muted-foreground">{role}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Upcoming meetings */}
      {meetings.length > 0 && (
        <section className="mt-8">
          <SectionHeader title="Upcoming meetings" actionLabel="View all" actionTo="/app/meetings" />
          <div className="mt-3 space-y-2">
            {meetings.map((m) => {
              const otherId = m.host_id === user?.id ? m.attendee_id : m.host_id;
              const p = profileMap[otherId];
              const dt = new Date(m.scheduled_at);
              return (
                <article key={m.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
                  <Avatar initials={initialsOf(p?.full_name)} src={p?.avatar_url} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      with {p?.full_name || "—"} · {dt.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

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
            {suggested.map((mr) => {
              const p = mr.profile;
              return (
                <article key={p.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                  <div className="flex items-center gap-3">
                    <Avatar initials={initialsOf(p.full_name)} src={p.avatar_url} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{p.full_name || "Member"}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.practice_areas?.[0] || "Attorney"}
                        {p.years_experience ? ` · ${p.years_experience} yrs` : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {mr.score}%
                    </span>
                  </div>
                  {mr.reasons[0] && (
                    <p className="mt-3 text-xs text-muted-foreground">{mr.reasons.slice(0, 2).join(" · ")}</p>
                  )}
                  <div className="mt-4">
                    <Link to="/app/discover" className="block w-full rounded-lg bg-primary px-3 py-2 text-center text-xs font-medium text-primary-foreground shadow-elegant hover:bg-primary/90">View directory</Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-3 ring-1 ring-inset ring-white/10">
      <p className="font-serif text-2xl font-semibold text-gold">{v}</p>
      <p className="mt-0.5 text-xs text-white/70">{l}</p>
    </div>
  );
}

function SectionHeader({ title, subtitle, actionLabel, actionTo }: { title: string; subtitle?: string; actionLabel?: string; actionTo?: string }) {
  return (
    <div className="flex items-end justify-between">
      <div>
        <h2 className="font-serif text-lg font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {actionLabel && actionTo && (
        <Link to={actionTo} className="text-xs font-medium text-primary hover:underline">{actionLabel}</Link>
      )}
    </div>
  );
}
