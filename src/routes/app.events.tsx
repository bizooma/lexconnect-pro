import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatInTz } from "@/lib/event-time";

export const Route = createFileRoute("/app/events")({
  component: MemberEventsPage,
  head: () => ({
    meta: [
      { title: "Events — LexGuild" },
      { name: "description", content: "Browse upcoming organization events, RSVP, and manage your registrations." },
      { property: "og:title", content: "Events — LexGuild" },
      { property: "og:description", content: "Browse upcoming organization events, RSVP, and manage your registrations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  location_name: string | null;
  location_address: string | null;
  is_virtual: boolean;
  virtual_url: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  capacity: number | null;
  visibility: string;
  rsvp_enabled: boolean;
  cover_image_url: string | null;
  status: string;
};

type MyRsvp = { event_id: string; status: string };

const viewerTz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

/** Escaped light-markdown renderer — plain React nodes, no HTML passthrough. */
function inlineMd(text: string, keyBase: string) {
  const nodes: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) nodes.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let bullets: string[] = [];
  const flush = (k: string) => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`ul-${k}`} className="list-disc space-y-1 pl-5">
        {bullets.map((b, i) => (
          <li key={i}>{inlineMd(b, `${k}-${i}`)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      bullets.push(bullet[1]);
      return;
    }
    flush(String(idx));
    if (line.trim()) blocks.push(<p key={`p-${idx}`}>{inlineMd(line, `p${idx}`)}</p>);
  });
  flush("end");
  return <div className="space-y-3 text-sm leading-relaxed">{blocks}</div>;
}

function TimeLine({ event }: { event: EventRow }) {
  const local = viewerTz();
  const showLocal = local && local !== event.timezone;
  return (
    <div className="text-sm text-muted-foreground">
      <p>{formatInTz(event.starts_at, event.timezone)}{event.ends_at ? ` – ${formatInTz(event.ends_at, event.timezone)}` : ""}</p>
      {showLocal && (
        <p className="text-xs">
          Your time: {formatInTz(event.starts_at, local)}
          {event.ends_at ? ` – ${formatInTz(event.ends_at, local)}` : ""}
        </p>
      )}
    </div>
  );
}

function MemberEventsPage() {
  const { user } = useAuth();
  const { currentOrgId, loading } = useCurrentOrg();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [mine, setMine] = useState<MyRsvp[]>([]);
  const [counts, setCounts] = useState<Record<string, { going: number; waitlist: number }>>({});
  const [tab, setTab] = useState<"upcoming" | "past" | "mine">("upcoming");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EventRow | null>(null);

  const refresh = useCallback(async () => {
    if (!currentOrgId) return;
    const [{ data: ev, error }, { data: rs }, { data: allRs }] = await Promise.all([
      supabase
        .from("org_events")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("starts_at", { ascending: true }),
      user
        ? supabase.from("event_rsvps").select("event_id, status").eq("user_id", user.id)
        : Promise.resolve({ data: [] as MyRsvp[] }),
      supabase.from("event_rsvps").select("event_id, status").eq("organization_id", currentOrgId),
    ]);
    if (error) { toast.error(error.message); return; }
    setEvents((ev ?? []) as EventRow[]);
    setMine((rs ?? []) as MyRsvp[]);
    const map: Record<string, { going: number; waitlist: number }> = {};
    for (const r of (allRs ?? []) as MyRsvp[]) {
      const c = (map[r.event_id] ??= { going: 0, waitlist: 0 });
      if (r.status === "going") c.going += 1;
      else if (r.status === "waitlist") c.waitlist += 1;
    }
    setCounts(map);
  }, [currentOrgId, user]);

  useEffect(() => { void refresh(); }, [refresh]);

  const myStatus = useCallback(
    (id: string) => mine.find((r) => r.event_id === id)?.status ?? null,
    [mine],
  );

  const rsvp = async (e: EventRow) => {
    setBusyId(e.id);
    const { data, error } = await supabase.rpc("rsvp_to_event", { _event_id: e.id });
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    const status = (data as { status?: string } | null)?.status;
    toast.success(status === "waitlist" ? "You're on the waitlist" : "You're going!");
    await refresh();
  };

  const cancel = async (e: EventRow) => {
    setBusyId(e.id);
    const { error } = await supabase.rpc("cancel_event_rsvp", { _event_id: e.id });
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("RSVP cancelled");
    await refresh();
  };

  const now = Date.now();
  const visible = useMemo(() => {
    return events.filter((e) => {
      const status = myStatus(e.id);
      if (tab === "mine") return status === "going" || status === "waitlist";
      if (e.status !== "published") return false;
      const upcoming = new Date(e.starts_at).getTime() >= now;
      return tab === "upcoming" ? upcoming : !upcoming;
    });
  }, [events, tab, myStatus, now]);

  const groups = useMemo(() => {
    const out: { label: string; rows: EventRow[] }[] = [];
    for (const e of visible) {
      const label = new Intl.DateTimeFormat("en-US", {
        timeZone: e.timezone,
        month: "long",
        year: "numeric",
      }).format(new Date(e.starts_at));
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push(e);
      else out.push({ label, rows: [e] });
    }
    return out;
  }, [visible]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold">Events</h1>
        <p className="text-sm text-muted-foreground">
          Upcoming events from your organization. RSVP and keep track of what you signed up for.
        </p>
      </div>

      <div className="flex w-fit gap-1 rounded-lg border border-border p-1">
        {([["upcoming", "Upcoming"], ["past", "Past"], ["mine", "My RSVPs"]] as const).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          {tab === "mine" ? "You haven't RSVP'd to any events yet." : `No ${tab} events.`}
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.label} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</h2>
            {g.rows.map((e) => {
              const c = counts[e.id] ?? { going: 0, waitlist: 0 };
              const status = myStatus(e.id);
              const full = e.capacity != null && c.going >= e.capacity;
              const cancelled = e.status === "cancelled";
              return (
                <article key={e.id} className="overflow-hidden rounded-lg border border-border bg-card">
                  {e.cover_image_url && (
                    <img
                      src={e.cover_image_url}
                      alt={`${e.title} cover`}
                      loading="lazy"
                      className="h-40 w-full object-cover"
                    />
                  )}
                  <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="truncate text-left font-medium hover:underline"
                          onClick={() => setDetail(e)}
                        >
                          {e.title}
                        </button>
                        {cancelled && <Badge variant="destructive">Cancelled</Badge>}
                        {status === "going" && <Badge>Going</Badge>}
                        {status === "waitlist" && <Badge variant="secondary">Waitlisted</Badge>}
                      </div>
                      <div className="mt-1"><TimeLine event={e} /></div>
                      <p className="text-sm text-muted-foreground">
                        {e.is_virtual ? "Virtual" : e.location_name || "Location TBD"}
                        {e.rsvp_enabled && !cancelled && (
                          <>
                            {" · "}
                            {c.going}
                            {e.capacity != null ? `/${e.capacity}` : ""} going
                            {c.waitlist > 0 ? ` (+${c.waitlist} waitlist)` : ""}
                          </>
                        )}
                      </p>
                      {!e.rsvp_enabled && !cancelled && (
                        <p className="mt-1 text-xs text-muted-foreground">RSVPs not required — announcement only.</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setDetail(e)}>Details</Button>
                      {!cancelled && e.rsvp_enabled && (
                        status === "going" || status === "waitlist" ? (
                          <Button size="sm" variant="ghost" disabled={busyId === e.id} onClick={() => cancel(e)}>
                            Cancel RSVP
                          </Button>
                        ) : (
                          <Button size="sm" disabled={busyId === e.id} onClick={() => rsvp(e)}>
                            {full ? "Event full — join waitlist" : "RSVP"}
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ))
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {detail.status === "cancelled" && (
                  <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    This event has been cancelled by the organizer.
                  </p>
                )}
                {detail.cover_image_url && (
                  <img src={detail.cover_image_url} alt={`${detail.title} cover`} className="w-full rounded-md object-cover" />
                )}
                <TimeLine event={detail} />
                {detail.is_virtual ? (
                  myStatus(detail.id) === "going" && detail.virtual_url ? (
                    <p className="text-sm">
                      Join link:{" "}
                      <a className="text-primary underline" href={detail.virtual_url} target="_blank" rel="noopener noreferrer">
                        {detail.virtual_url}
                      </a>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Virtual event — the join link appears here once you're going.
                    </p>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {detail.location_name || "Location TBD"}
                    {detail.location_address ? ` · ${detail.location_address}` : ""}
                  </p>
                )}
                {detail.description && <Markdown text={detail.description} />}
                {detail.status !== "cancelled" && detail.rsvp_enabled && (
                  <div className="flex gap-2 pt-2">
                    {myStatus(detail.id) ? (
                      <Button variant="outline" disabled={busyId === detail.id} onClick={() => cancel(detail)}>
                        Cancel RSVP
                      </Button>
                    ) : (
                      <Button disabled={busyId === detail.id} onClick={() => rsvp(detail)}>RSVP</Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
