import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profiles";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { Avatar } from "@/components/avatar";
import { initialsOf } from "@/hooks/use-profiles";

export const Route = createFileRoute("/app/activity")({
  component: ActivityPage,
});

type MentorshipRow = {
  id: string;
  mentor_id: string;
  mentee_id: string;
  requested_by: string | null;
  status: "pending" | "active" | "declined" | string;
  intro_message: string | null;
  created_at: string;
  updated_at: string;
  organization_id: string;
};

type ActivityEvent = {
  id: string;
  at: string;
  kind: "request" | "accepted" | "declined" | "concluded";
  actorId: string;
  recipientId: string;
  message?: string | null;
};

function ActivityPage() {
  const { user } = useAuth();
  const { profile } = useMyProfile();
  const { currentOrgId } = useCurrentOrg();
  const orgId = currentOrgId ?? profile?.organization_id ?? null;

  const [rows, setRows] = useState<MentorshipRow[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, { full_name: string | null; avatar_url: string | null }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !orgId) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("mentorships")
        .select("id,mentor_id,mentee_id,requested_by,status,intro_message,created_at,updated_at,organization_id")
        .eq("organization_id", orgId)
        .order("updated_at", { ascending: false });
      const ms = (data as MentorshipRow[] | null) ?? [];
      setRows(ms);
      const ids = new Set<string>();
      ms.forEach((m) => { ids.add(m.mentor_id); ids.add(m.mentee_id); if (m.requested_by) ids.add(m.requested_by); });
      if (ids.size > 0) {
        const { data: p } = await supabase
          .from("profiles")
          .select("user_id,full_name,avatar_url")
          .in("user_id", Array.from(ids));
        const map: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
        (p ?? []).forEach((row: any) => { map[row.user_id] = { full_name: row.full_name, avatar_url: row.avatar_url }; });
        setProfileMap(map);
      }
      setLoading(false);
    })();
  }, [user, orgId]);

  const events = useMemo<ActivityEvent[]>(() => {
    const out: ActivityEvent[] = [];
    for (const m of rows) {
      const requester = m.requested_by ?? m.mentee_id;
      const recipient = requester === m.mentor_id ? m.mentee_id : m.mentor_id;
      // Intro message can contain private context — only show it to the
      // mentorship participants, not to org admins viewing the global feed.
      const isParticipant = !!user && (user.id === m.mentor_id || user.id === m.mentee_id);
      out.push({
        id: `${m.id}:req`,
        at: m.created_at,
        kind: "request",
        actorId: requester,
        recipientId: recipient,
        message: isParticipant ? m.intro_message : null,
      });
      if (m.status === "active") {
        out.push({
          id: `${m.id}:acc`,
          at: m.updated_at,
          kind: "accepted",
          actorId: recipient,
          recipientId: requester,
        });
      } else if (m.status === "declined") {
        out.push({
          id: `${m.id}:dec`,
          at: m.updated_at,
          kind: "declined",
          actorId: recipient,
          recipientId: requester,
        });
      } else if (m.status === "completed") {
        out.push({
          id: `${m.id}:acc`,
          at: m.created_at,
          kind: "accepted",
          actorId: recipient,
          recipientId: requester,
        });
        out.push({
          id: `${m.id}:end`,
          at: m.updated_at,
          kind: "concluded",
          actorId: recipient,
          recipientId: requester,
        });
      }
    }
    out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return out;
  }, [rows, user]);

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  };

  const verb = (e: ActivityEvent) => {
    const actor = profileMap[e.actorId]?.full_name || "A member";
    const target = profileMap[e.recipientId]?.full_name || "a member";
    if (e.kind === "request") return <><span className="font-medium text-foreground">{actor}</span> requested mentorship from <span className="font-medium text-foreground">{target}</span>.</>;
    if (e.kind === "accepted") return <><span className="font-medium text-foreground">{actor}</span> accepted <span className="font-medium text-foreground">{target}</span>'s mentorship request.</>;
    if (e.kind === "concluded") return <>Mentorship between <span className="font-medium text-foreground">{actor}</span> and <span className="font-medium text-foreground">{target}</span> was concluded.</>;
    return <><span className="font-medium text-foreground">{actor}</span> declined <span className="font-medium text-foreground">{target}</span>'s mentorship request.</>;
  };

  const dot = (kind: ActivityEvent["kind"]) => {
    const cls = kind === "accepted" ? "bg-emerald-500" : kind === "declined" ? "bg-rose-500" : kind === "concluded" ? "bg-muted-foreground" : "bg-primary";
    return <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} />;
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8 lg:py-10">
      <header className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-foreground">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">A running history of mentorship activity in your organization.</p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading activity…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ol className="space-y-3">
          {events.map((e) => {
            const p = profileMap[e.actorId];
            return (
              <li key={e.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
                <Avatar initials={initialsOf(p?.full_name)} src={p?.avatar_url} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-muted-foreground">{verb(e)}</p>
                  {e.kind === "request" && e.message && (
                    <p className="mt-1 truncate text-xs italic text-muted-foreground">"{e.message}"</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">{fmt(e.at)}</p>
                </div>
                {dot(e.kind)}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
