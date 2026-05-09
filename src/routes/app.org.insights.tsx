import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";

export const Route = createFileRoute("/app/org/insights")({
  component: OrgInsightsPage,
});

const WEEKS = 8;
const ACTIVE_WINDOW_DAYS = 30;

type MemberRow = {
  user_id: string;
  org_role: "owner" | "admin" | "member";
  joined_at: string | null;
  profile: {
    full_name: string | null;
    headline: string | null;
    avatar_url: string | null;
    is_mentor: boolean;
    is_mentee: boolean;
  } | null;
  messages30: number;
  meetings30: number;
  activeMentorships: number;
  lastActive: string | null;
};

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function fmtWeek(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function OrgInsightsPage() {
  const { currentOrgId, currentOrg, subscription, isOrgAdmin } = useCurrentOrg();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [weekly, setWeekly] = useState<{ week: string; messages: number; meetings: number; activeMembers: number }[]>([]);
  const [mentorshipFunnel, setMentorshipFunnel] = useState({ pending: 0, active: 0, completed: 0, declined: 0 });
  const [sortBy, setSortBy] = useState<"name" | "messages" | "meetings" | "lastActive">("lastActive");

  useEffect(() => {
    if (!currentOrgId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const now = new Date();
      const since30 = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const weeks: Date[] = [];
      const monday = startOfWeek(now);
      for (let i = WEEKS - 1; i >= 0; i--) {
        weeks.push(new Date(monday.getTime() - i * 7 * 24 * 60 * 60 * 1000));
      }
      const earliest = weeks[0];

      // 1. Members + profiles
      const { data: memberRows } = await supabase
        .from("organization_members")
        .select("user_id, org_role, joined_at, status")
        .eq("organization_id", currentOrgId)
        .eq("status", "active");

      const userIds = (memberRows ?? []).map((m) => m.user_id).filter(Boolean) as string[];
      const { data: profileRows } = userIds.length
        ? await supabase
            .from("profiles")
            .select("user_id, full_name, headline, avatar_url, is_mentor, is_mentee")
            .in("user_id", userIds)
        : { data: [] as any[] };
      const profileMap = new Map((profileRows ?? []).map((p: any) => [p.user_id, p]));

      // 2. Conversations in this org → messages
      const { data: convRows } = await supabase
        .from("conversations")
        .select("id")
        .eq("organization_id", currentOrgId);
      const convIds = (convRows ?? []).map((c) => c.id);

      const { data: msgRows } = convIds.length
        ? await supabase
            .from("messages")
            .select("sender_id, created_at")
            .in("conversation_id", convIds)
            .gte("created_at", earliest.toISOString())
        : { data: [] as any[] };

      // 3. Meetings in org
      const { data: meetingRows } = await supabase
        .from("meetings")
        .select("host_id, attendee_id, scheduled_at, created_at, status")
        .eq("organization_id", currentOrgId)
        .gte("created_at", earliest.toISOString());

      // 4. Mentorships in org
      const { data: mentorshipRows } = await supabase
        .from("mentorships")
        .select("mentor_id, mentee_id, status, created_at, updated_at")
        .eq("organization_id", currentOrgId);

      // ---- Build weekly trend ----
      const weeklyMap = weeks.map((w) => ({
        weekStart: w,
        messages: 0,
        meetings: 0,
        activeUsers: new Set<string>(),
      }));
      const weekIndex = (ts: string) => {
        const d = new Date(ts);
        for (let i = weeklyMap.length - 1; i >= 0; i--) {
          if (d >= weeklyMap[i].weekStart) return i;
        }
        return -1;
      };
      for (const m of msgRows ?? []) {
        const i = weekIndex(m.created_at);
        if (i >= 0) {
          weeklyMap[i].messages++;
          if (m.sender_id) weeklyMap[i].activeUsers.add(m.sender_id);
        }
      }
      for (const mt of meetingRows ?? []) {
        const i = weekIndex(mt.created_at);
        if (i >= 0) {
          weeklyMap[i].meetings++;
          if (mt.host_id) weeklyMap[i].activeUsers.add(mt.host_id);
          if (mt.attendee_id) weeklyMap[i].activeUsers.add(mt.attendee_id);
        }
      }
      const weeklySeries = weeklyMap.map((w) => ({
        week: fmtWeek(w.weekStart),
        messages: w.messages,
        meetings: w.meetings,
        activeMembers: w.activeUsers.size,
      }));

      // ---- Per-member 30d activity ----
      const since30Iso = since30.toISOString();
      const perMember = new Map<string, { messages: number; meetings: number; lastActive: string | null }>();
      for (const uid of userIds) perMember.set(uid, { messages: 0, meetings: 0, lastActive: null });

      const bump = (uid: string | null | undefined, ts: string) => {
        if (!uid) return;
        const rec = perMember.get(uid);
        if (!rec) return;
        if (!rec.lastActive || ts > rec.lastActive) rec.lastActive = ts;
      };

      for (const m of msgRows ?? []) {
        if (m.created_at >= since30Iso && m.sender_id && perMember.has(m.sender_id)) {
          perMember.get(m.sender_id)!.messages++;
        }
        bump(m.sender_id, m.created_at);
      }
      for (const mt of meetingRows ?? []) {
        if (mt.created_at >= since30Iso) {
          if (mt.host_id && perMember.has(mt.host_id)) perMember.get(mt.host_id)!.meetings++;
          if (mt.attendee_id && perMember.has(mt.attendee_id)) perMember.get(mt.attendee_id)!.meetings++;
        }
        bump(mt.host_id, mt.created_at);
        bump(mt.attendee_id, mt.created_at);
      }

      // active mentorships per user
      const activeMentorshipCount = new Map<string, number>();
      let funnelP = 0, funnelA = 0, funnelC = 0, funnelD = 0;
      for (const ms of mentorshipRows ?? []) {
        if (ms.status === "pending") funnelP++;
        else if (ms.status === "active") {
          funnelA++;
          activeMentorshipCount.set(ms.mentor_id, (activeMentorshipCount.get(ms.mentor_id) ?? 0) + 1);
          activeMentorshipCount.set(ms.mentee_id, (activeMentorshipCount.get(ms.mentee_id) ?? 0) + 1);
        } else if (ms.status === "completed") funnelC++;
        else if (ms.status === "declined") funnelD++;
      }

      const memberTable: MemberRow[] = (memberRows ?? []).map((m) => {
        const stats = perMember.get(m.user_id!) ?? { messages: 0, meetings: 0, lastActive: null };
        return {
          user_id: m.user_id!,
          org_role: m.org_role,
          joined_at: m.joined_at,
          profile: (profileMap.get(m.user_id!) as MemberRow["profile"]) ?? null,
          messages30: stats.messages,
          meetings30: stats.meetings,
          activeMentorships: activeMentorshipCount.get(m.user_id!) ?? 0,
          lastActive: stats.lastActive,
        };
      });

      if (cancelled) return;
      setMembers(memberTable);
      setWeekly(weeklySeries);
      setMentorshipFunnel({ pending: funnelP, active: funnelA, completed: funnelC, declined: funnelD });
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [currentOrgId]);

  const sortedMembers = useMemo(() => {
    const arr = [...members];
    arr.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.profile?.full_name ?? "").localeCompare(b.profile?.full_name ?? "");
        case "messages":
          return b.messages30 - a.messages30;
        case "meetings":
          return b.meetings30 - a.meetings30;
        case "lastActive":
        default:
          return (b.lastActive ?? "").localeCompare(a.lastActive ?? "");
      }
    });
    return arr;
  }, [members, sortBy]);

  const seatStats = useMemo(() => {
    const cap = (subscription as any)?.max_users ?? subscription?.seats_purchased ?? 0;
    const total = members.length;
    const since30 = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    let active = 0, dormant = 0, never = 0;
    for (const m of members) {
      if (!m.lastActive) never++;
      else if (m.lastActive >= since30) active++;
      else dormant++;
    }
    const efficiency = total ? Math.round((active / total) * 100) : 0;
    const engagedSeats = active;
    const wastedSeats = dormant + never;
    const engagementPerSeat = total
      ? +(members.reduce((s, m) => s + m.messages30 + m.meetings30 * 3 + m.activeMentorships * 5, 0) / total).toFixed(1)
      : 0;
    return { cap, total, active, dormant, never, efficiency, engagedSeats, wastedSeats, engagementPerSeat };
  }, [members, subscription]);

  if (!currentOrgId) {
    return <div className="p-8 text-sm text-muted-foreground">No organization selected.</div>;
  }

  if (!isOrgAdmin) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="font-serif text-2xl font-semibold">Insights are admin-only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask an owner or admin of {currentOrg?.name} to share these analytics with you.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Insights</p>
          <h1 className="mt-1 font-serif text-2xl font-semibold text-foreground sm:text-3xl">
            {currentOrg?.name} · Engagement
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Activity over the last {WEEKS} weeks. "Active" = engaged in the last {ACTIVE_WINDOW_DAYS} days.
          </p>
        </div>
        <Link to="/app/org" className="text-sm text-primary hover:underline">← Back to overview</Link>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading insights…</p>
      ) : (
        <>
          {/* Seat efficiency block */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Seat efficiency" value={`${seatStats.efficiency}%`} hint={`${seatStats.active} of ${seatStats.total} seats active`} />
            <Stat label="Dormant seats" value={seatStats.dormant + seatStats.never} hint="No activity in 30d — recoverable" tone={seatStats.wastedSeats > 0 ? "warn" : "ok"} />
            <Stat label="Engagement / seat" value={seatStats.engagementPerSeat} hint="Weighted msgs + meetings + mentorships" />
            <Stat label="Seats used" value={`${seatStats.total} / ${seatStats.cap || "∞"}`} hint="Plan capacity" />
          </section>

          {/* Trend chart */}
          <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-serif text-lg font-semibold">Weekly active members</h2>
              <p className="text-xs text-muted-foreground">Last {WEEKS} weeks</p>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weekly} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="activeMembers" name="Active members" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Activity volume */}
          <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h2 className="mb-3 font-serif text-lg font-semibold">Messages & meetings per week</h2>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekly} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="messages" name="Messages" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="meetings" name="Meetings" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h2 className="mb-3 font-serif text-lg font-semibold">Mentorship funnel</h2>
              <div className="space-y-3">
                <FunnelRow label="Pending requests" value={mentorshipFunnel.pending} total={mentorshipFunnel.pending + mentorshipFunnel.active + mentorshipFunnel.completed + mentorshipFunnel.declined} tone="muted" />
                <FunnelRow label="Active pairings" value={mentorshipFunnel.active} total={mentorshipFunnel.pending + mentorshipFunnel.active + mentorshipFunnel.completed + mentorshipFunnel.declined} tone="primary" />
                <FunnelRow label="Completed" value={mentorshipFunnel.completed} total={mentorshipFunnel.pending + mentorshipFunnel.active + mentorshipFunnel.completed + mentorshipFunnel.declined} tone="success" />
                <FunnelRow label="Declined" value={mentorshipFunnel.declined} total={mentorshipFunnel.pending + mentorshipFunnel.active + mentorshipFunnel.completed + mentorshipFunnel.declined} tone="muted" />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Conversion: <span className="font-medium text-foreground">
                  {mentorshipFunnel.pending + mentorshipFunnel.active + mentorshipFunnel.completed > 0
                    ? Math.round(((mentorshipFunnel.active + mentorshipFunnel.completed) / (mentorshipFunnel.pending + mentorshipFunnel.active + mentorshipFunnel.completed + mentorshipFunnel.declined)) * 100)
                    : 0}%
                </span> of requests turn into pairings.
              </p>
            </div>
          </section>

          {/* Member activity table */}
          <section className="mt-6 rounded-2xl border border-border bg-card shadow-card">
            <div className="flex flex-col gap-2 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-serif text-lg font-semibold">Per-member activity (30d)</h2>
                <p className="text-xs text-muted-foreground">Identify dormant seats you could reclaim or re-engage.</p>
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="rounded-md border border-border bg-card px-2 py-1.5 text-xs"
              >
                <option value="lastActive">Sort: Last active</option>
                <option value="messages">Sort: Messages</option>
                <option value="meetings">Sort: Meetings</option>
                <option value="name">Sort: Name</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Member</th>
                    <th className="px-4 py-2 text-left">Role</th>
                    <th className="px-4 py-2 text-right">Messages</th>
                    <th className="px-4 py-2 text-right">Meetings</th>
                    <th className="px-4 py-2 text-right">Mentorships</th>
                    <th className="px-4 py-2 text-left">Last active</th>
                    <th className="px-4 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((m) => {
                    const since30 = Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
                    const status = !m.lastActive ? "never" : new Date(m.lastActive).getTime() >= since30 ? "active" : "dormant";
                    return (
                      <tr key={m.user_id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2">
                          <div className="font-medium text-foreground">{m.profile?.full_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{m.profile?.headline ?? ""}</div>
                        </td>
                        <td className="px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">{m.org_role}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{m.messages30}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{m.meetings30}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{m.activeMentorships}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {m.lastActive ? new Date(m.lastActive).toLocaleDateString() : "Never"}
                        </td>
                        <td className="px-4 py-2">
                          <StatusBadge status={status} />
                        </td>
                      </tr>
                    );
                  })}
                  {sortedMembers.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">No members yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <p className="mt-4 text-xs text-muted-foreground">
            Tip for pricing: orgs with high <em>engagement / seat</em> tolerate higher per-seat cost. Orgs with many dormant seats often resist seat increases — re-engagement campaigns recover ARR before the renewal conversation.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "ok" | "warn" }) {
  const ring = tone === "warn" ? "border-amber-500/40" : "border-border";
  return (
    <div className={`rounded-xl border ${ring} bg-card p-4 shadow-card`}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function FunnelRow({ label, value, total, tone }: { label: string; value: number; total: number; tone: "primary" | "success" | "muted" }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const bar = tone === "primary" ? "bg-primary" : tone === "success" ? "bg-emerald-500" : "bg-muted-foreground/40";
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">{value}</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "active" | "dormant" | "never" }) {
  const map = {
    active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dormant: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    never: "bg-muted text-muted-foreground",
  } as const;
  const label = status === "active" ? "Active" : status === "dormant" ? "Dormant" : "Never logged in";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[status]}`}>{label}</span>;
}
