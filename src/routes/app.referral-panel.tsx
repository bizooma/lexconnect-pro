import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Mail, Phone, Inbox } from "lucide-react";
import { PRACTICE_AREAS, practiceAreaLabel } from "@/lib/practice-areas";

export const Route = createFileRoute("/app/referral-panel")({
  head: () => ({
    meta: [
      { title: "Referral Panel — LexGuild" },
      {
        name: "description",
        content: "Join your bar's lawyer referral panel and manage cases routed to you from public intakes.",
      },
      { property: "og:title", content: "Referral Panel — LexGuild" },
      {
        property: "og:description",
        content: "Join your bar's lawyer referral panel and manage cases routed to you from public intakes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReferralPanelPage,
});

type PanelRow = {
  id: string;
  organization_id: string;
  user_id: string;
  practice_areas: string[] | null;
  counties: string[] | null;
  languages: string[] | null;
  capacity_status: string;
  max_active_referrals: number | null;
  is_active: boolean;
  application_status: string;
  notes: string | null;
};

type Intake = {
  id: string;
  intake_number: string;
  caller_name: string;
  caller_email: string | null;
  caller_phone: string | null;
  area_of_law: string;
  county: string | null;
  narrative: string | null;
  urgency: string | null;
  created_at: string;
};

type Assignment = {
  id: string;
  intake_id: string;
  panel_user_id: string;
  status: string;
  response_note: string | null;
  assigned_at: string;
  responded_at: string | null;
};

function parseCsv(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

function urgencyVariant(u: string | null) {
  if (u === "high") return "destructive" as const;
  if (u === "low") return "outline" as const;
  return "secondary" as const;
}

function statusVariant(s: string) {
  if (s === "accepted" || s === "contacted" || s === "approved") return "default" as const;
  if (s === "declined" || s === "suspended") return "destructive" as const;
  return "secondary" as const;
}

function AreaPicker({
  selected, onChange,
}: { selected: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {PRACTICE_AREAS.map((a) => {
        const checked = selected.includes(a.value);
        return (
          <label key={a.value} className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={checked}
              onCheckedChange={(v) =>
                onChange(v ? [...selected, a.value] : selected.filter((x) => x !== a.value))
              }
            />
            {a.label}
          </label>
        );
      })}
    </div>
  );
}

function ReferralPanelPage() {
  const { user } = useAuth();
  const { currentOrgId, loading: orgLoading } = useCurrentOrg();
  const me = user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<PanelRow | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [intakes, setIntakes] = useState<Record<string, Intake>>({});

  const load = useCallback(async () => {
    if (!me || !currentOrgId) return;
    setLoading(true);
    const { data: panelRow } = await supabase
      .from("referral_panel")
      .select("*")
      .eq("organization_id", currentOrgId)
      .eq("user_id", me)
      .maybeSingle();
    setPanel((panelRow as PanelRow | null) ?? null);

    const { data: rows } = await supabase
      .from("referral_assignments")
      .select("*")
      .eq("panel_user_id", me)
      .order("assigned_at", { ascending: false });
    const list = (rows ?? []) as Assignment[];
    setAssignments(list);

    const ids = Array.from(new Set(list.map((a) => a.intake_id)));
    if (ids.length) {
      const { data: intakeRows } = await supabase
        .from("referral_intakes")
        .select("*")
        .in("id", ids);
      const map: Record<string, Intake> = {};
      for (const i of (intakeRows ?? []) as Intake[]) map[i.id] = i;
      setIntakes(map);
    } else {
      setIntakes({});
    }
    setLoading(false);
  }, [me, currentOrgId]);

  useEffect(() => { void load(); }, [load]);

  if (orgLoading || loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!currentOrgId) {
    return <div className="p-8 text-sm text-muted-foreground">Select an organization to continue.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-foreground">Referral Panel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Join your organization's lawyer referral panel and manage public referral cases routed to you.
        </p>
      </header>

      <PanelSection orgId={currentOrgId} panel={panel} onSaved={load} />
      <AssignedCases assignments={assignments} intakes={intakes} onChanged={load} />
    </div>
  );
}

function PanelSection({
  orgId, panel, onSaved,
}: { orgId: string; panel: PanelRow | null; onSaved: () => void }) {
  const [areas, setAreas] = useState<string[]>(panel?.practice_areas ?? []);
  const [counties, setCounties] = useState((panel?.counties ?? []).join(", "));
  const [languages, setLanguages] = useState((panel?.languages ?? ["English"]).join(", "));
  const [capacity, setCapacity] = useState(panel?.capacity_status ?? "available");
  const [maxActive, setMaxActive] = useState(String(panel?.max_active_referrals ?? 5));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAreas(panel?.practice_areas ?? []);
    setCounties((panel?.counties ?? []).join(", "));
    setLanguages((panel?.languages ?? ["English"]).join(", "));
    setCapacity(panel?.capacity_status ?? "available");
    setMaxActive(String(panel?.max_active_referrals ?? 5));
  }, [panel]);

  const apply = async () => {
    if (areas.length === 0) { toast.error("Select at least one practice area."); return; }
    setSaving(true);
    const { error } = await supabase.rpc("apply_to_referral_panel", {
      _org_id: orgId,
      _practice_areas: areas,
      _counties: parseCsv(counties),
      _languages: parseCsv(languages),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Application submitted — pending review.");
    onSaved();
  };

  const save = async () => {
    if (areas.length === 0) { toast.error("Select at least one practice area."); return; }
    setSaving(true);
    const { error } = await supabase.rpc("update_my_panel_profile", {
      _org_id: orgId,
      _practice_areas: areas,
      _counties: parseCsv(counties),
      _languages: parseCsv(languages),
      _capacity_status: capacity,
      _max_active_referrals: Number(maxActive) || 0,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Routing preferences updated.");
    onSaved();
  };

  const fields = (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block">Practice areas</Label>
        <AreaPicker selected={areas} onChange={setAreas} />
      </div>
      <div>
        <Label htmlFor="counties">Counties (comma-separated)</Label>
        <Input id="counties" value={counties} onChange={(e) => setCounties(e.target.value)} placeholder="Travis, Williamson" />
      </div>
      <div>
        <Label htmlFor="languages">Languages (comma-separated)</Label>
        <Input id="languages" value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="English, Spanish" />
      </div>
    </div>
  );

  return (
    <section className="mb-8 rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-lg font-semibold text-foreground">My panel membership</h2>
        {panel && (
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant(panel.application_status)}>{panel.application_status}</Badge>
            <Badge variant={panel.is_active ? "outline" : "secondary"}>
              {panel.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
        )}
      </div>

      {!panel && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Join the referral panel to receive public referral cases matched to your practice areas.
          </p>
          {fields}
          <Button onClick={apply} disabled={saving}>
            {saving ? "Submitting…" : "Join the referral panel"}
          </Button>
        </div>
      )}

      {panel?.application_status === "pending" && (
        <p className="text-sm text-muted-foreground">Pending review.</p>
      )}

      {panel?.application_status === "suspended" && (
        <p className="text-sm text-destructive">
          Your panel membership is suspended — contact the bar.
        </p>
      )}

      {panel?.application_status === "approved" && (
        <div className="space-y-4">
          {fields}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Capacity</Label>
              <Select value={capacity} onValueChange={setCapacity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="limited">Limited</SelectItem>
                  <SelectItem value="at_capacity">At capacity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="maxActive">Max active referrals</Label>
              <Input
                id="maxActive"
                type="number"
                min={0}
                value={maxActive}
                onChange={(e) => setMaxActive(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </div>
      )}
    </section>
  );
}

function AssignedCases({
  assignments, intakes, onChanged,
}: { assignments: Assignment[]; intakes: Record<string, Intake>; onChanged: () => void }) {
  return (
    <section>
      <h2 className="mb-4 font-serif text-lg font-semibold text-foreground">Assigned cases</h2>
      {assignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Inbox className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No cases have been assigned to you yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((a) => (
            <AssignmentCard key={a.id} assignment={a} intake={intakes[a.intake_id]} onChanged={onChanged} />
          ))}
        </div>
      )}
    </section>
  );
}

function AssignmentCard({
  assignment, intake, onChanged,
}: { assignment: Assignment; intake?: Intake; onChanged: () => void }) {
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [busy, setBusy] = useState(false);

  const respond = async (status: "accepted" | "declined" | "contacted") => {
    setBusy(true);
    const { error } = await supabase.rpc("respond_to_referral_assignment", {
      _assignment_id: assignment.id,
      _status: status,
      _note: note || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Referral ${status}.`);
    setNote("");
    setShowNote(false);
    onChanged();
  };

  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{intake?.intake_number ?? "—"}</span>
          <Badge variant={statusVariant(assignment.status)}>{assignment.status}</Badge>
          {intake?.urgency && <Badge variant={urgencyVariant(intake.urgency)}>{intake.urgency}</Badge>}
        </div>
        <span className="text-xs text-muted-foreground">Assigned {fmtDate(assignment.assigned_at)}</span>
      </div>

      {intake ? (
        <>
          <p className="text-sm font-medium text-foreground">{intake.caller_name}</p>
          <div className="mt-1 flex flex-wrap gap-4 text-xs text-muted-foreground">
            {intake.caller_email && (
              <a className="inline-flex items-center gap-1 hover:text-foreground" href={`mailto:${intake.caller_email}`}>
                <Mail className="h-3.5 w-3.5" />{intake.caller_email}
              </a>
            )}
            {intake.caller_phone && (
              <a className="inline-flex items-center gap-1 hover:text-foreground" href={`tel:${intake.caller_phone}`}>
                <Phone className="h-3.5 w-3.5" />{intake.caller_phone}
              </a>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {practiceAreaLabel(intake.area_of_law)}{intake.county ? ` · ${intake.county}` : ""}
          </p>
          {intake.narrative && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{intake.narrative}</p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Case details unavailable.</p>
      )}

      {assignment.response_note && (
        <p className="mt-2 text-xs text-muted-foreground">Your note: {assignment.response_note}</p>
      )}

      {(assignment.status === "pending" || assignment.status === "accepted") && (
        <div className="mt-4 space-y-2">
          {showNote && (
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note"
              rows={2}
            />
          )}
          <div className="flex flex-wrap gap-2">
            {assignment.status === "pending" && (
              <>
                <Button size="sm" disabled={busy} onClick={() => respond("accepted")}>Accept</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => respond("declined")}>Decline</Button>
              </>
            )}
            {assignment.status === "accepted" && (
              <Button size="sm" disabled={busy} onClick={() => respond("contacted")}>Mark contacted</Button>
            )}
            {!showNote && (
              <Button size="sm" variant="ghost" onClick={() => setShowNote(true)}>Add note</Button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
