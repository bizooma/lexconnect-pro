import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";

export const Route = createFileRoute("/app/org/")({
  component: OrgOverviewPage,
});

function OrgOverviewPage() {
  const { currentOrgId, currentOrg, subscription, role } = useCurrentOrg();
  const [stats, setStats] = useState({
    members: 0,
    activeMentorships: 0,
    pendingInvites: 0,
    weeklyMessages: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrgId) return;
    setLoading(true);
    (async () => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [m, mt, inv, msgs] = await Promise.all([
        supabase.from("organization_members").select("id", { count: "exact", head: true })
          .eq("organization_id", currentOrgId).eq("status", "active"),
        supabase.from("mentorships").select("id", { count: "exact", head: true })
          .eq("organization_id", currentOrgId).eq("status", "active"),
        supabase.from("organization_invites").select("id", { count: "exact", head: true })
          .eq("organization_id", currentOrgId).is("accepted_at", null),
        supabase.from("conversations").select("id").eq("organization_id", currentOrgId),
      ]);
      let weekly = 0;
      const convIds = (msgs.data ?? []).map((c) => c.id);
      if (convIds.length) {
        const { count } = await supabase.from("messages")
          .select("id", { count: "exact", head: true })
          .in("conversation_id", convIds)
          .gte("created_at", weekAgo);
        weekly = count ?? 0;
      }
      setStats({
        members: m.count ?? 0,
        activeMentorships: mt.count ?? 0,
        pendingInvites: inv.count ?? 0,
        weeklyMessages: weekly,
      });
      setLoading(false);
    })();
  }, [currentOrgId]);

  if (!currentOrgId) return <div className="p-8 text-sm text-muted-foreground">No organization selected.</div>;

  const cap = (subscription as any)?.max_users ?? subscription?.seats_purchased ?? 0;
  const used = stats.members;
  const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
  const nearCap = cap > 0 && used / cap >= 0.8;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Organization</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-foreground">{currentOrg?.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your role: <span className="font-medium text-foreground">{role}</span></p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total members" value={stats.members} />
            <Stat label="Active mentorships" value={stats.activeMentorships} />
            <Stat label="Pending invites" value={stats.pendingInvites} />
            <Stat label="Messages this week" value={stats.weeklyMessages} />
          </div>

          <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-lg font-semibold text-foreground">Seat utilization</h2>
              <p className="text-sm text-muted-foreground">
                {used} / {cap || "∞"} seats used
              </p>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${nearCap ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct}%` }} />
            </div>
            {nearCap && (
              <p className="mt-3 text-sm text-destructive">You're approaching your seat limit. Consider upgrading your plan.</p>
            )}
            <div className="mt-4">
              <Link to="/app/org/billing" className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-elegant transition hover:bg-primary/90">
                Upgrade organization plan
              </Link>
            </div>
          </section>

          <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <QuickLink to="/app/org/members" title="Manage members" desc="Invite, change roles, remove" />
            <QuickLink to="/app/org/billing" title="Billing & seats" desc="Plan and seat usage" />
            <QuickLink to="/app/org/settings" title="Org settings" desc="Branding and details" />
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function QuickLink({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link to={to} className="rounded-xl border border-border bg-card p-4 shadow-card transition hover:border-primary/40">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
    </Link>
  );
}
