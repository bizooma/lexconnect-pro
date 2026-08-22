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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Mail, Phone } from "lucide-react";

export const Route = createFileRoute("/app/lrs")({
  component: LrsPage,
  head: () => ({
    meta: [
      { title: "Referral Service — LexGuild" },
      {
        name: "description",
        content: "Manage public referral intakes, match callers to panel attorneys, and administer your referral panel.",
      },
      { property: "og:title", content: "Referral Service — LexGuild" },
      {
        property: "og:description",
        content: "Manage public referral intakes, match callers to panel attorneys, and administer your referral panel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Intake = {
  id: string;
  organization_id: string;
  intake_number: string;
  caller_name: string;
  caller_email: string | null;
  caller_phone: string | null;
  area_of_law: string;
  county: string | null;
  narrative: string | null;
  urgency: string | null;
  language_preference: string | null;
  status: string;
  assigned_user_id: string | null;
  source: string | null;
  created_at: string;
};

type PanelRow = {
  id: string;
  organization_id: string;
  user_id: string;
  practice_areas: string[] | null;
  counties: string[] | null;
  languages: string[] | null;
  capacity_status: string;
  max_active_referrals: number | null;
  excluded_flags: string[] | null;
  is_active: boolean;
  application_status: string;
  notes: string | null;
  last_assigned_at: string | null;
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

type ProfileLite = { user_id: string; full_name: string | null; firm: string | null };

type MatchRow = {
  user_id: string;
  full_name: string;
  firm: string | null;
  score: number;
  breakdown: Record<string, number>;
  active_count: number;
  capacity_status: string;
};

const INTAKE_FILTERS = [
  { key: "new", label: "New", statuses: ["new"] },
  { key: "matched", label: "Matched", statuses: ["matched"] },
  { key: "assigned", label: "Assigned", statuses: ["assigned"] },
  { key: "closed", label: "Closed/Cancelled", statuses: ["closed", "cancelled"] },
] as const;

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

function csv(v: string[] | null | undefined) {
  return (v ?? []).join(", ");
}

function parseCsv(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

function LrsPage() {
  const { currentOrgId, isOrgAdmin, loading } = useCurrentOrg();
  const [tab, setTab] = useState<"intakes" | "panel">("intakes");

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!isOrgAdmin) return <Navigate to="/app/dashboard" />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-foreground">Referral Service</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage public intakes, match callers with panel attorneys, and administer your referral panel.
        </p>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="intakes">Intakes</TabsTrigger>
          <TabsTrigger value="panel">Panel</TabsTrigger>
        </TabsList>
        <TabsContent value="intakes" className="mt-6">
          <IntakesTab orgId={currentOrgId ?? null} />
        </TabsContent>
        <TabsContent value="panel" className="mt-6">
          <PanelTab orgId={currentOrgId ?? null} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IntakesTab({ orgId }: { orgId: string | null }) {
  const [rows, setRows] = useState<Intake[]>([]);
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState<string>("new");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("referral_intakes")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as Intake[]);
    setBusy(false);
  }, [orgId]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of INTAKE_FILTERS) {
      m[f.key] = rows.filter((r) => (f.statuses as readonly string[]).includes(r.status)).length;
    }
    return m;
  }, [rows]);

  const visible = useMemo(() => {
    const f = INTAKE_FILTERS.find((x) => x.key === filter);
    if (!f) return rows;
    return rows.filter((r) => (f.statuses as readonly string[]).includes(r.status));
  }, [rows, filter]);

  const selected = rows.find((r) => r.id === openId) ?? null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {INTAKE_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {f.label} ({counts[f.key] ?? 0})
          </button>
        ))}
      </div>

      {busy ? (
        <p className="text-sm text-muted-foreground">Loading intakes…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No intakes in this bucket yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Intake</th>
                <th className="px-3 py-2">Caller</th>
                <th className="px-3 py-2">Area of law</th>
                <th className="px-3 py-2">County</th>
                <th className="px-3 py-2">Urgency</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setOpenId(r.id)}
                  className="cursor-pointer border-t border-border hover:bg-accent/50"
                >
                  <td className="px-3 py-2 font-mono text-xs">{r.intake_number}</td>
                  <td className="px-3 py-2 font-medium">{r.caller_name}</td>
                  <td className="px-3 py-2">{r.area_of_law}</td>
                  <td className="px-3 py-2">{r.county ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant={urgencyVariant(r.urgency)}>{r.urgency ?? "normal"}</Badge>
                  </td>
                  <td className="px-3 py-2"><Badge variant="outline">{r.status}</Badge></td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) setOpenId(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.intake_number}</SheetTitle>
              </SheetHeader>
              <IntakeDetail intake={selected} onChanged={load} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function IntakeDetail({ intake, onChanged }: { intake: Intake; onChanged: () => Promise<void> | void }) {
  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [matching, setMatching] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [assignee, setAssignee] = useState<ProfileLite | null>(null);

  const loadAssignment = useCallback(async () => {
    const { data } = await supabase
      .from("referral_assignments")
      .select("*")
      .eq("intake_id", intake.id)
      .order("assigned_at", { ascending: false })
      .limit(1);
    const row = (data?.[0] ?? null) as Assignment | null;
    setAssignment(row);
    if (row) {
      const { data: p } = await supabase
        .from("profiles")
        .select("user_id, full_name, firm")
        .eq("user_id", row.panel_user_id)
        .maybeSingle();
      setAssignee((p ?? null) as ProfileLite | null);
    } else {
      setAssignee(null);
    }
  }, [intake.id]);

  useEffect(() => { void loadAssignment(); }, [loadAssignment]);

  const runMatch = async () => {
    setMatching(true);
    const { data, error } = await supabase.rpc("run_intake_matching", { _intake_id: intake.id });
    setMatching(false);
    if (error) { toast.error(error.message); return; }
    setMatches((data ?? []) as unknown as MatchRow[]);
  };

  const assign = async (panelUserId: string) => {
    setAssigning(panelUserId);
    const { error } = await supabase.rpc("assign_referral", {
      _intake_id: intake.id,
      _panel_user_id: panelUserId,
    });
    setAssigning(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Referral assigned");
    setMatches(null);
    await loadAssignment();
    await onChanged();
  };

  const setStatus = async (status: string) => {
    const { error } = await supabase
      .from("referral_intakes")
      .update({ status: status as Intake["status"] })
      .eq("id", intake.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Intake ${status}`);
    await onChanged();
  };

  return (
    <div className="mt-4 space-y-6 pb-10">
      <section className="space-y-2 rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{intake.status}</Badge>
          <Badge variant={urgencyVariant(intake.urgency)}>{intake.urgency ?? "normal"}</Badge>
          <span className="text-xs text-muted-foreground">{fmtDate(intake.created_at)}</span>
        </div>
        <h3 className="text-lg font-semibold text-foreground">{intake.caller_name}</h3>
        <div className="flex flex-wrap gap-3 text-sm">
          {intake.caller_email && (
            <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`mailto:${intake.caller_email}`}>
              <Mail className="h-3.5 w-3.5" />{intake.caller_email}
            </a>
          )}
          {intake.caller_phone && (
            <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`tel:${intake.caller_phone}`}>
              <Phone className="h-3.5 w-3.5" />{intake.caller_phone}
            </a>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-xs text-muted-foreground">Area of law</dt><dd>{intake.area_of_law}</dd></div>
          <div><dt className="text-xs text-muted-foreground">County</dt><dd>{intake.county ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Language</dt><dd>{intake.language_preference ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Source</dt><dd>{intake.source ?? "—"}</dd></div>
        </dl>
        {intake.narrative && (
          <div>
            <p className="text-xs text-muted-foreground">Narrative</p>
            <p className="whitespace-pre-wrap text-sm text-foreground">{intake.narrative}</p>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={() => setStatus("closed")}>Close</Button>
          <Button size="sm" variant="outline" onClick={() => setStatus("cancelled")}>Cancel</Button>
        </div>
      </section>

      {assignment && (
        <section className="space-y-2 rounded-lg border border-border p-4">
          <h4 className="text-sm font-semibold text-foreground">Assigned attorney</h4>
          <p className="text-sm">
            {assignee?.full_name ?? "Member"}
            {assignee?.firm ? <span className="text-muted-foreground"> · {assignee.firm}</span> : null}
          </p>
          <Badge variant="outline">{assignment.status}</Badge>
          {assignment.response_note && (
            <p className="text-sm text-muted-foreground">“{assignment.response_note}”</p>
          )}
        </section>
      )}

      <section className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">Panel matching</h4>
          <Button size="sm" onClick={runMatch} disabled={matching}>
            {matching ? "Matching…" : assignment ? "Re-run match / reassign" : "Run match"}
          </Button>
        </div>
        {matches && matches.length === 0 && (
          <p className="text-sm text-muted-foreground">No approved, active panel attorneys found.</p>
        )}
        {matches && matches.length > 0 && (
          <ul className="space-y-2">
            {matches.map((m) => (
              <li key={m.user_id} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {m.full_name}
                      {m.firm ? <span className="text-muted-foreground"> · {m.firm}</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Score {m.score} · {m.active_count} active · {m.capacity_status}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                      {Object.entries(m.breakdown ?? {}).map(([k, v]) => (
                        <span key={k} className="rounded bg-muted px-1.5 py-0.5">
                          {k}: {v > 0 ? `+${v}` : v}
                        </span>
                      ))}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={assigning === m.user_id}
                    onClick={() => assign(m.user_id)}
                  >
                    {assigning === m.user_id ? "Assigning…" : "Assign"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PanelTab({ orgId }: { orgId: string | null }) {
  const [rows, setRows] = useState<PanelRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [activeCounts, setActiveCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(true);
  const [editing, setEditing] = useState<PanelRow | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("referral_panel")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    const panel = (data ?? []) as PanelRow[];
    setRows(panel);

    const ids = panel.map((p) => p.user_id);
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, firm")
        .in("user_id", ids);
      const map: Record<string, ProfileLite> = {};
      for (const p of (profs ?? []) as ProfileLite[]) map[p.user_id] = p;
      setProfiles(map);

      const { data: assigns } = await supabase
        .from("referral_assignments")
        .select("panel_user_id, status")
        .eq("organization_id", orgId)
        .in("status", ["pending", "accepted", "contacted"]);
      const counts: Record<string, number> = {};
      for (const a of (assigns ?? []) as { panel_user_id: string }[]) {
        counts[a.panel_user_id] = (counts[a.panel_user_id] ?? 0) + 1;
      }
      setActiveCounts(counts);
    }
    setBusy(false);
  }, [orgId]);

  useEffect(() => { void load(); }, [load]);

  const update = async (id: string, patch: Partial<PanelRow>) => {
    const { error } = await supabase.from("referral_panel").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    await load();
    return true;
  };

  const pending = rows.filter((r) => r.application_status === "pending");
  const rest = rows.filter((r) => r.application_status !== "pending");

  if (busy) return <p className="text-sm text-muted-foreground">Loading panel…</p>;

  const nameOf = (r: PanelRow) => profiles[r.user_id]?.full_name ?? "Member";
  const firmOf = (r: PanelRow) => profiles[r.user_id]?.firm ?? null;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Pending applications ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No pending applications.
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((r) => (
              <li key={r.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">
                      {nameOf(r)}{firmOf(r) ? <span className="text-muted-foreground"> · {firmOf(r)}</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">Practice areas: {csv(r.practice_areas) || "—"}</p>
                    <p className="text-xs text-muted-foreground">Counties: {csv(r.counties) || "—"}</p>
                    <p className="text-xs text-muted-foreground">Languages: {csv(r.languages) || "—"}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={async () => {
                      if (await update(r.id, { application_status: "approved", is_active: true })) {
                        toast.success("Application approved");
                      }
                    }}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={async () => {
                      if (await update(r.id, { application_status: "suspended", is_active: false })) {
                        toast.success("Application declined");
                      }
                    }}>Decline</Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Panel members ({rest.length})
        </h2>
        {rest.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No approved panel members yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {rest.map((r) => (
              <li key={r.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {nameOf(r)}{firmOf(r) ? <span className="text-muted-foreground"> · {firmOf(r)}</span> : null}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline">{r.application_status}</Badge>
                      <Badge variant={r.is_active ? "secondary" : "outline"}>{r.is_active ? "active" : "inactive"}</Badge>
                      <Badge variant="outline">{r.capacity_status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Practice areas: {csv(r.practice_areas) || "—"}</p>
                    <p className="text-xs text-muted-foreground">Counties: {csv(r.counties) || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {activeCounts[r.user_id] ?? 0} active
                      {r.max_active_referrals != null ? ` / ${r.max_active_referrals} max` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(r)}>Edit</Button>
                    {r.application_status === "approved" && r.is_active ? (
                      <Button size="sm" variant="outline" onClick={async () => {
                        if (await update(r.id, { application_status: "suspended", is_active: false })) {
                          toast.success("Panelist suspended");
                        }
                      }}>Suspend</Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={async () => {
                        if (await update(r.id, { application_status: "approved", is_active: true })) {
                          toast.success("Panelist reactivated");
                        }
                      }}>Reactivate</Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PanelEditSheet
        row={editing}
        onClose={() => setEditing(null)}
        onSave={async (patch) => {
          if (!editing) return;
          if (await update(editing.id, patch)) {
            toast.success("Panel profile updated");
            setEditing(null);
          }
        }}
      />
    </div>
  );
}

function PanelEditSheet({
  row, onClose, onSave,
}: {
  row: PanelRow | null;
  onClose: () => void;
  onSave: (patch: Partial<PanelRow>) => Promise<void>;
}) {
  const [areas, setAreas] = useState("");
  const [counties, setCounties] = useState("");
  const [languages, setLanguages] = useState("");
  const [excluded, setExcluded] = useState("");
  const [capacity, setCapacity] = useState("available");
  const [maxActive, setMaxActive] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!row) return;
    setAreas(csv(row.practice_areas));
    setCounties(csv(row.counties));
    setLanguages(csv(row.languages));
    setExcluded(csv(row.excluded_flags));
    setCapacity(row.capacity_status);
    setMaxActive(row.max_active_referrals != null ? String(row.max_active_referrals) : "");
    setNotes(row.notes ?? "");
  }, [row]);

  return (
    <Sheet open={!!row} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>Edit panel profile</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-4 pb-10">
          <div>
            <Label htmlFor="lrs-areas">Practice areas (comma separated)</Label>
            <Input id="lrs-areas" value={areas} onChange={(e) => setAreas(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="lrs-counties">Counties (comma separated)</Label>
            <Input id="lrs-counties" value={counties} onChange={(e) => setCounties(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="lrs-langs">Languages (comma separated)</Label>
            <Input id="lrs-langs" value={languages} onChange={(e) => setLanguages(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="lrs-excl">Excluded matter types (comma separated)</Label>
            <Input id="lrs-excl" value={excluded} onChange={(e) => setExcluded(e.target.value)} />
          </div>
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
            <Label htmlFor="lrs-max">Max active referrals</Label>
            <Input
              id="lrs-max"
              type="number"
              min={0}
              value={maxActive}
              onChange={(e) => setMaxActive(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="lrs-notes">Staff notes</Label>
            <Textarea id="lrs-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() =>
                onSave({
                  practice_areas: parseCsv(areas),
                  counties: parseCsv(counties),
                  languages: parseCsv(languages),
                  excluded_flags: parseCsv(excluded),
                  capacity_status: capacity,
                  max_active_referrals: maxActive.trim() === "" ? null : Number(maxActive),
                  notes: notes.trim() === "" ? null : notes,
                })
              }
            >Save</Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
