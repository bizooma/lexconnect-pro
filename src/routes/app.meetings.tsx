import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { supabase } from "@/integrations/supabase/client";
import { initialsOf } from "@/hooks/use-profiles";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/app/meetings")({
  component: Meetings,
});

type Meeting = {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  host_id: string;
  attendee_id: string;
  location: string | null;
  notes: string | null;
  status: string;
};

type Connection = { user_id: string; full_name: string | null; avatar_url: string | null };

function Meetings() {
  const { user } = useAuth();
  const { currentOrgId } = useCurrentOrg();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, Connection>>({});
  const [loading, setLoading] = useState(true);

  const [scheduling, setScheduling] = useState(false);
  const [attendeeId, setAttendeeId] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("30");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: ms } = await supabase
      .from("meetings")
      .select("id,title,scheduled_at,duration_minutes,host_id,attendee_id,location,notes,status")
      .or(`host_id.eq.${user.id},attendee_id.eq.${user.id}`)
      .order("scheduled_at", { ascending: true });
    setMeetings((ms as Meeting[] | null) ?? []);

    // Connections from active mentorships
    const { data: mt } = await supabase
      .from("mentorships")
      .select("mentor_id,mentee_id,status")
      .or(`mentor_id.eq.${user.id},mentee_id.eq.${user.id}`)
      .eq("status", "active");
    const otherIds = new Set<string>();
    (mt ?? []).forEach((m: any) => {
      otherIds.add(m.mentor_id === user.id ? m.mentee_id : m.mentor_id);
    });
    (ms ?? []).forEach((m: any) => {
      otherIds.add(m.host_id === user.id ? m.attendee_id : m.host_id);
    });
    if (otherIds.size > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id,full_name,avatar_url")
        .in("user_id", Array.from(otherIds));
      const map: Record<string, Connection> = {};
      (profs ?? []).forEach((p: any) => { map[p.user_id] = p; });
      setProfileMap(map);
      setConnections(
        Array.from(otherIds)
          .filter((uid) => map[uid])
          .map((uid) => map[uid]),
      );
    } else {
      setConnections([]);
      setProfileMap({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const upcoming = useMemo(
    () => meetings.filter((m) => new Date(m.scheduled_at) >= new Date()),
    [meetings],
  );
  const past = useMemo(
    () => meetings.filter((m) => new Date(m.scheduled_at) < new Date()),
    [meetings],
  );

  const openScheduler = () => {
    setAttendeeId(connections[0]?.user_id ?? "");
    setTitle("Mentorship check-in");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDate(tomorrow.toISOString().slice(0, 10));
    setTime("10:00");
    setDuration("30");
    setLocation("Video call");
    setNotes("");
    setScheduling(true);
  };

  const submit = async () => {
    if (!user || !attendeeId || !title || !date || !time) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!currentOrgId) { toast.error("No organization selected"); return; }
    setSubmitting(true);
    const scheduledAt = new Date(`${date}T${time}`).toISOString();
    const { error } = await supabase.from("meetings").insert({
      title,
      scheduled_at: scheduledAt,
      duration_minutes: parseInt(duration, 10),
      host_id: user.id,
      attendee_id: attendeeId,
      location: location || null,
      notes: notes || null,
      status: "scheduled",
      organization_id: currentOrgId,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Meeting scheduled");
    setScheduling(false);
    load();
  };

  const cancel = async (id: string) => {
    const { error } = await supabase.from("meetings").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Meeting cancelled");
    load();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-foreground lg:text-3xl">Meetings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Coffees, video calls, and check-ins with your matches.</p>
        </div>
        <Button onClick={openScheduler} disabled={connections.length === 0}>
          + New
        </Button>
      </div>

      {connections.length === 0 && !loading && (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-card/50 p-4 text-sm text-muted-foreground">
          You can schedule meetings with your active mentors and mentees. Accept or send a mentorship request to get started.
        </p>
      )}

      <Section title="Upcoming">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading meetings…</p>
        ) : upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming meetings.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((m) => (
              <MeetingCard key={m.id} m={m} otherProfile={profileMap[m.host_id === user?.id ? m.attendee_id : m.host_id]} onCancel={cancel} canCancel />
            ))}
          </div>
        )}
      </Section>

      {past.length > 0 && (
        <Section title="Past">
          <div className="space-y-3">
            {past.slice(0, 10).map((m) => (
              <MeetingCard key={m.id} m={m} otherProfile={profileMap[m.host_id === user?.id ? m.attendee_id : m.host_id]} onCancel={cancel} />
            ))}
          </div>
        </Section>
      )}

      <Dialog open={scheduling} onOpenChange={setScheduling}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule a meeting</DialogTitle>
            <DialogDescription>Send an invite to one of your connections.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="With">
              <Select value={attendeeId} onValueChange={setAttendeeId}>
                <SelectTrigger><SelectValue placeholder="Select a connection…" /></SelectTrigger>
                <SelectContent>
                  {connections.map((c) => (
                    <SelectItem key={c.user_id} value={c.user_id}>{c.full_name || "Member"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Time"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Duration (min)">
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["15", "30", "45", "60", "90"].map((d) => (
                      <SelectItem key={d} value={d}>{d} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Location"><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Video, café…" /></Field>
            </div>
            <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setScheduling(false)}>Cancel</Button>
            <Button onClick={submit} disabled={submitting}>{submitting ? "Scheduling…" : "Schedule"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="font-serif text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
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

function MeetingCard({
  m, otherProfile, onCancel, canCancel,
}: {
  m: Meeting;
  otherProfile?: Connection;
  onCancel: (id: string) => void;
  canCancel?: boolean;
}) {
  const dt = new Date(m.scheduled_at);
  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <Avatar initials={initialsOf(otherProfile?.full_name)} src={otherProfile?.avatar_url} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{m.title}</p>
          <p className="text-xs text-muted-foreground">
            with {otherProfile?.full_name || "—"} ·{" "}
            {dt.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            {" · "}{m.duration_minutes} min{m.location ? ` · ${m.location}` : ""}
          </p>
          {m.notes && <p className="mt-2 text-xs text-muted-foreground">{m.notes}</p>}
        </div>
        {canCancel && (
          <button onClick={() => onCancel(m.id)} className="text-xs text-muted-foreground hover:text-destructive">
            Cancel
          </button>
        )}
      </div>
    </article>
  );
}
