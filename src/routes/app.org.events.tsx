import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ImageUploader } from "@/components/website/ImageUploader";
import {
  DEFAULT_TZ, allTimezones, formatInTz, utcISOToZonedLocal, zonedLocalToUtcISO,
} from "@/lib/event-time";

export const Route = createFileRoute("/app/org/events")({
  component: EventsAdminPage,
  head: () => ({
    meta: [
      { title: "Events admin — LexGuild" },
      { name: "description", content: "Create, publish, and manage your organization's events and RSVP rosters." },
      { property: "og:title", content: "Events admin — LexGuild" },
      { property: "og:description", content: "Create, publish, and manage your organization's events and RSVP rosters." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type EventRow = {
  id: string;
  organization_id: string;
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

type RsvpRow = {
  id: string;
  event_id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  status: string;
  created_at: string;
};

type Tab = "upcoming" | "past" | "drafts";

const emptyForm = {
  title: "",
  description: "",
  location_name: "",
  location_address: "",
  is_virtual: false,
  virtual_url: "",
  starts_local: "",
  ends_local: "",
  timezone: DEFAULT_TZ,
  capacity: "",
  visibility: "members",
  rsvp_enabled: true,
  cover_image_url: null as string | null,
};

function EventsAdminPage() {
  const { currentOrgId, isOrgAdmin, loading } = useCurrentOrg();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [rsvps, setRsvps] = useState<RsvpRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [rosterFor, setRosterFor] = useState<EventRow | null>(null);
  const timezones = useMemo(() => allTimezones(), []);

  const refresh = useCallback(async () => {
    if (!currentOrgId) return;
    setBusy(true);
    const [{ data: ev, error: evErr }, { data: rs }] = await Promise.all([
      supabase
        .from("org_events")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("starts_at", { ascending: true }),
      supabase
        .from("event_rsvps")
        .select("id, event_id, user_id, guest_name, guest_email, status, created_at")
        .eq("organization_id", currentOrgId),
    ]);
    setBusy(false);
    if (evErr) { toast.error(evErr.message); return; }
    setEvents((ev ?? []) as EventRow[]);
    const rows = (rs ?? []) as RsvpRow[];
    setRsvps(rows);
    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      const map: Record<string, string> = {};
      for (const p of profs ?? []) map[p.user_id] = p.full_name ?? "Member";
      setNames(map);
    }
  }, [currentOrgId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const countsFor = useCallback(
    (eventId: string) => {
      const rows = rsvps.filter((r) => r.event_id === eventId);
      return {
        going: rows.filter((r) => r.status === "going").length,
        waitlist: rows.filter((r) => r.status === "waitlist").length,
      };
    },
    [rsvps],
  );

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setEditorOpen(true);
  };

  const openEdit = (e: EventRow) => {
    setEditing(e);
    setForm({
      title: e.title,
      description: e.description ?? "",
      location_name: e.location_name ?? "",
      location_address: e.location_address ?? "",
      is_virtual: e.is_virtual,
      virtual_url: e.virtual_url ?? "",
      starts_local: utcISOToZonedLocal(e.starts_at, e.timezone),
      ends_local: utcISOToZonedLocal(e.ends_at, e.timezone),
      timezone: e.timezone || DEFAULT_TZ,
      capacity: e.capacity == null ? "" : String(e.capacity),
      visibility: e.visibility,
      rsvp_enabled: e.rsvp_enabled,
      cover_image_url: e.cover_image_url,
    });
    setEditorOpen(true);
  };

  const save = async (status: "draft" | "published") => {
    if (!currentOrgId) return;
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    if (!form.starts_local) { toast.error("Start date and time is required"); return; }
    const startsISO = zonedLocalToUtcISO(form.starts_local, form.timezone);
    const endsISO = form.ends_local ? zonedLocalToUtcISO(form.ends_local, form.timezone) : null;
    if (endsISO && startsISO && new Date(endsISO) < new Date(startsISO)) {
      toast.error("End time must be after the start time");
      return;
    }
    const payload = {
      organization_id: currentOrgId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      location_name: form.is_virtual ? null : form.location_name.trim() || null,
      location_address: form.is_virtual ? null : form.location_address.trim() || null,
      is_virtual: form.is_virtual,
      virtual_url: form.is_virtual ? form.virtual_url.trim() || null : null,
      starts_at: startsISO!,
      ends_at: endsISO,
      timezone: form.timezone,
      capacity: form.capacity.trim() === "" ? null : Number(form.capacity),
      visibility: form.visibility,
      rsvp_enabled: form.rsvp_enabled,
      cover_image_url: form.cover_image_url,
      status: editing && editing.status === "cancelled" ? "cancelled" : status,
    };
    setBusy(true);
    const { error } = editing
      ? await supabase.from("org_events").update(payload).eq("id", editing.id)
      : await supabase.from("org_events").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Event saved" : status === "published" ? "Event published" : "Draft saved");
    setEditorOpen(false);
    void refresh();
  };

  const setStatus = async (e: EventRow, status: string) => {
    if (status === "cancelled" && !confirm(`Cancel "${e.title}"? Attendees keep their RSVP records.`)) return;
    const { error } = await supabase.from("org_events").update({ status }).eq("id", e.id);
    if (error) toast.error(error.message);
    else { toast.success(`Event ${status === "draft" ? "unpublished" : status}`); void refresh(); }
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!isOrgAdmin) return <Navigate to="/app/dashboard" />;

  const now = Date.now();
  const visible = events.filter((e) => {
    if (tab === "drafts") return e.status === "draft";
    if (e.status === "draft") return false;
    const upcoming = new Date(e.starts_at).getTime() >= now;
    return tab === "upcoming" ? upcoming : !upcoming;
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Events</h1>
          <p className="text-sm text-muted-foreground">
            Create events, publish them to members, and manage RSVP rosters.
          </p>
        </div>
        <Button onClick={openNew}>New event</Button>
      </div>

      <div className="flex gap-1 rounded-lg border border-border p-1 w-fit">
        {(["upcoming", "past", "drafts"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {busy && <p className="text-sm text-muted-foreground">Loading…</p>}

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          No {tab} events yet.
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((e) => {
            const c = countsFor(e.id);
            return (
              <div key={e.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-medium">{e.title}</h2>
                    <StatusBadge status={e.status} />
                    {e.visibility === "public" && <Badge variant="outline">Public</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatInTz(e.starts_at, e.timezone)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {e.is_virtual ? "Virtual" : e.location_name || "Location TBD"}
                    {" · "}
                    {c.going}
                    {e.capacity != null ? `/${e.capacity}` : ""} going
                    {c.waitlist > 0 ? ` (+${c.waitlist} waitlist)` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setRosterFor(e)}>Roster</Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(e)}>Edit</Button>
                  {e.status !== "published" && (
                    <Button size="sm" onClick={() => setStatus(e, "published")}>Publish</Button>
                  )}
                  {e.status === "published" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(e, "draft")}>Unpublish</Button>
                  )}
                  {e.status !== "cancelled" && (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setStatus(e, "cancelled")}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor */}
      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit event" : "New event"}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ev-title">Title *</Label>
              <Input id="ev-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-desc">Description</Label>
              <Textarea
                id="ev-desc"
                rows={6}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Plain text or light markdown (**bold**, - bullets)"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="ev-virtual">Virtual event</Label>
                <p className="text-xs text-muted-foreground">Hides the venue fields and asks for a join link.</p>
              </div>
              <Switch
                id="ev-virtual"
                checked={form.is_virtual}
                onCheckedChange={(v) => setForm({ ...form, is_virtual: v })}
              />
            </div>

            {form.is_virtual ? (
              <div className="space-y-1.5">
                <Label htmlFor="ev-url">Virtual link</Label>
                <Input
                  id="ev-url"
                  value={form.virtual_url}
                  onChange={(e) => setForm({ ...form, virtual_url: e.target.value })}
                  placeholder="https://…"
                />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="ev-loc">Venue name</Label>
                  <Input id="ev-loc" value={form.location_name} onChange={(e) => setForm({ ...form, location_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ev-addr">Address</Label>
                  <Input id="ev-addr" value={form.location_address} onChange={(e) => setForm({ ...form, location_address: e.target.value })} />
                </div>
              </>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ev-start">Starts *</Label>
                <Input
                  id="ev-start"
                  type="datetime-local"
                  value={form.starts_local}
                  onChange={(e) => setForm({ ...form, starts_local: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-end">Ends</Label>
                <Input
                  id="ev-end"
                  type="datetime-local"
                  value={form.ends_local}
                  onChange={(e) => setForm({ ...form, ends_local: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Time zone (times above are entered in this zone)</Label>
              <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ev-cap">Capacity</Label>
                <Input
                  id="ev-cap"
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  placeholder="Blank = unlimited"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Visibility</Label>
                <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="members">Members only</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="ev-rsvp">RSVPs enabled</Label>
                <p className="text-xs text-muted-foreground">Turn off for announcement-only events.</p>
              </div>
              <Switch
                id="ev-rsvp"
                checked={form.rsvp_enabled}
                onCheckedChange={(v) => setForm({ ...form, rsvp_enabled: v })}
              />
            </div>

            {currentOrgId && (
              <ImageUploader
                organizationId={currentOrgId}
                value={form.cover_image_url}
                onChange={(url) => setForm({ ...form, cover_image_url: url })}
                label="Cover image"
                aspect="wide"
              />
            )}

            <div className="flex flex-wrap gap-2 pb-6 pt-2">
              <Button disabled={busy} onClick={() => save("published")}>
                {editing?.status === "published" ? "Save" : "Publish"}
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => save("draft")}>
                Save as draft
              </Button>
              <Button variant="ghost" onClick={() => setEditorOpen(false)}>Close</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Roster */}
      <Sheet open={!!rosterFor} onOpenChange={(o) => !o && setRosterFor(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {rosterFor && (
            <RosterPanel
              event={rosterFor}
              rows={rsvps.filter((r) => r.event_id === rosterFor.id)}
              names={names}
              onChanged={refresh}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "published") return <Badge>Published</Badge>;
  if (status === "cancelled") return <Badge variant="destructive">Cancelled</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}

function RosterPanel({
  event,
  rows,
  names,
  onChanged,
}: {
  event: EventRow;
  rows: RsvpRow[];
  names: Record<string, string>;
  onChanged: () => void | Promise<void>;
}) {
  const label = (r: RsvpRow) =>
    r.user_id ? names[r.user_id] ?? "Member" : r.guest_name || "Guest";
  const contact = (r: RsvpRow) => (r.user_id ? "Member" : r.guest_email || "—");

  const going = rows.filter((r) => r.status === "going");
  const waitlist = rows.filter((r) => r.status === "waitlist");

  const remove = async (r: RsvpRow) => {
    if (!confirm(`Remove ${label(r)} from the roster?`)) return;
    const { error } = await supabase.from("event_rsvps").delete().eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success("Attendee removed"); await onChanged(); }
  };

  const promote = async (r: RsvpRow) => {
    const { error } = await supabase.from("event_rsvps").update({ status: "going" }).eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success("Promoted from waitlist"); await onChanged(); }
  };

  const exportCsv = () => {
    // Neutralize CSV formula injection: guest-supplied values are untrusted.
    const esc = (v: string) => {
      const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const lines = [
      ["Name", "Email", "Type", "Status", "RSVP time"].join(","),
      ...rows
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((r) =>
          [
            esc(label(r)),
            esc(r.user_id ? "" : r.guest_email ?? ""),
            esc(r.user_id ? "member" : "guest"),
            esc(r.status),
            esc(formatInTz(r.created_at, event.timezone)),
          ].join(","),
        ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-roster.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const Row = ({ r, promotable }: { r: RsvpRow; promotable?: boolean }) => (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{label(r)}</p>
        <p className="truncate text-xs text-muted-foreground">
          {contact(r)} · {formatInTz(r.created_at, event.timezone)}
        </p>
      </div>
      <div className="flex gap-2">
        {promotable && (
          <Button size="sm" variant="outline" onClick={() => promote(r)}>Promote</Button>
        )}
        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(r)}>
          Remove
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <SheetHeader>
        <SheetTitle>{event.title} — roster</SheetTitle>
      </SheetHeader>
      <div className="mt-4 space-y-5 pb-8">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {going.length}
            {event.capacity != null ? `/${event.capacity}` : ""} going
            {waitlist.length > 0 ? ` · ${waitlist.length} waitlisted` : ""}
          </p>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            Export CSV
          </Button>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Going</h3>
          {going.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attendees yet.</p>
          ) : (
            going.map((r) => <Row key={r.id} r={r} />)
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Waitlist</h3>
          {waitlist.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody is waitlisted.</p>
          ) : (
            waitlist.map((r) => <Row key={r.id} r={r} promotable />)
          )}
        </section>
      </div>
    </>
  );
}
