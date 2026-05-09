import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialsOf, locationOf, type Profile } from "@/hooks/use-profiles";
import { scoreMatches, buildActiveLoadMap, type ExistingPair, type MatchResult } from "@/lib/matching";
import { toast } from "sonner";

export const Route = createFileRoute("/app/org/matching")({
  component: OrgMatchingPage,
});

const PROFILE_COLS =
  "id,user_id,full_name,headline,firm,city,state,practice_areas,years_experience,bio,avatar_url,is_mentor,is_mentee,accepting_mentees,bar_admissions,meeting_cadence";

type MenteeStatus = "unmatched" | "pending" | "active";

function OrgMatchingPage() {
  const { currentOrgId, currentOrg, isOrgAdmin } = useCurrentOrg();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pairs, setPairs] = useState<ExistingPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MenteeStatus | "all">("unmatched");
  const [submitting, setSubmitting] = useState<string | null>(null);

  const refresh = async () => {
    if (!currentOrgId) return;
    setLoading(true);
    const [{ data: members }, { data: ms }] = await Promise.all([
      supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", currentOrgId)
        .eq("status", "active"),
      supabase
        .from("mentorships")
        .select("mentor_id,mentee_id,status")
        .eq("organization_id", currentOrgId),
    ]);
    const ids = (members ?? []).map((m: any) => m.user_id).filter(Boolean);
    let profs: Profile[] = [];
    if (ids.length) {
      const { data } = await supabase.from("profiles").select(PROFILE_COLS).in("user_id", ids);
      profs = (data as Profile[] | null) ?? [];
    }
    setProfiles(profs);
    setPairs((ms as ExistingPair[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, [currentOrgId]);

  const profileByUser = useMemo(() => {
    const m = new Map<string, Profile>();
    profiles.forEach((p) => m.set(p.user_id, p));
    return m;
  }, [profiles]);

  const mentees = useMemo(() => profiles.filter((p) => p.is_mentee), [profiles]);

  const menteeStatusOf = (uid: string): MenteeStatus => {
    const rels = pairs.filter((p) => p.mentee_id === uid);
    if (rels.some((r) => r.status === "active")) return "active";
    if (rels.some((r) => r.status === "pending")) return "pending";
    return "unmatched";
  };

  const filteredMentees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mentees.filter((m) => {
      const st = menteeStatusOf(m.user_id);
      if (statusFilter !== "all" && st !== statusFilter) return false;
      if (!q) return true;
      const hay = `${m.full_name ?? ""} ${m.firm ?? ""} ${m.city ?? ""} ${m.state ?? ""} ${(m.practice_areas ?? []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [mentees, pairs, search, statusFilter]);

  const activeLoad = useMemo(() => buildActiveLoadMap(pairs), [pairs]);

  const selected = selectedId ? profileByUser.get(selectedId) ?? null : null;

  const candidateMatches: MatchResult[] = useMemo(() => {
    if (!selected) return [];
    return scoreMatches({
      viewer: selected,
      viewerIsMentee: true,
      candidates: profiles,
      existingPairs: pairs,
      activeLoad,
      softCapacity: 3,
    }).slice(0, 25);
  }, [selected, profiles, pairs, activeLoad]);

  const assign = async (mentorId: string, menteeId: string) => {
    if (!currentOrgId) return;
    setSubmitting(mentorId);
    const { error } = await supabase.from("mentorships").insert({
      mentor_id: mentorId,
      mentee_id: menteeId,
      status: "active",
      organization_id: currentOrgId,
    });
    setSubmitting(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Mentor assigned — conversation created");
    await refresh();
  };

  if (!currentOrgId) {
    return <div className="p-8 text-sm text-muted-foreground">No organization selected.</div>;
  }
  if (!isOrgAdmin) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="font-serif text-2xl font-semibold">Matching is admin-only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask an owner or admin of {currentOrg?.name} to grant you access.
        </p>
      </div>
    );
  }

  const unmatchedCount = mentees.filter((m) => menteeStatusOf(m.user_id) === "unmatched").length;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Matching</p>
          <h1 className="mt-1 font-serif text-2xl font-semibold text-foreground sm:text-3xl">
            {currentOrg?.name} · Pair members
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unmatchedCount} unmatched mentee{unmatchedCount === 1 ? "" : "s"}. Suggestions ranked by practice, seniority, and jurisdiction overlap.
          </p>
        </div>
        <Link to="/app/org" className="text-sm text-primary hover:underline">← Back to overview</Link>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading members…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          {/* Mentee list */}
          <aside className="rounded-2xl border border-border bg-card p-3 shadow-card">
            <div className="space-y-2 px-1 pb-3">
              <Input placeholder="Search mentees…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="flex gap-1 text-xs">
                {(["unmatched", "pending", "active", "all"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`rounded-full px-2.5 py-1 capitalize transition ${
                      statusFilter === s
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >{s}</button>
                ))}
              </div>
            </div>
            <div className="max-h-[70vh] space-y-1 overflow-y-auto">
              {filteredMentees.length === 0 && (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">No mentees match.</p>
              )}
              {filteredMentees.map((m) => {
                const st = menteeStatusOf(m.user_id);
                const isSel = selectedId === m.user_id;
                return (
                  <button
                    key={m.user_id}
                    onClick={() => setSelectedId(m.user_id)}
                    className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition ${
                      isSel ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                  >
                    <Avatar initials={initialsOf(m.full_name)} src={m.avatar_url} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{m.full_name ?? "Unnamed"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {(m.practice_areas ?? [])[0] ?? m.firm ?? "—"}
                      </p>
                    </div>
                    <StatusPill status={st} />
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Suggestions */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            {!selected ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                Select a mentee on the left to see ranked mentor suggestions.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-border pb-4">
                  <Avatar initials={initialsOf(selected.full_name)} src={selected.avatar_url} size={48} />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-serif text-lg font-semibold text-foreground">{selected.full_name ?? "Mentee"}</h2>
                    <p className="text-xs text-muted-foreground">
                      {(selected.practice_areas ?? []).join(", ") || "No practice areas"}
                      {selected.years_experience != null ? ` · ${selected.years_experience} yrs` : ""}
                      {locationOf(selected) ? ` · ${locationOf(selected)}` : ""}
                    </p>
                  </div>
                </div>

                <h3 className="mt-5 mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Top mentor matches
                </h3>
                {candidateMatches.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No eligible mentors yet — invite more attorneys or wait for members to mark themselves as accepting mentees.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {candidateMatches.map((mr) => {
                      const p = mr.profile;
                      const load = activeLoad.get(p.user_id) ?? 0;
                      return (
                        <li key={p.user_id} className="flex items-start gap-3 rounded-xl border border-border p-3 transition hover:border-primary/40">
                          <Avatar initials={initialsOf(p.full_name)} src={p.avatar_url} size={40} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <p className="truncate text-sm font-medium text-foreground">{p.full_name ?? "Mentor"}</p>
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                {mr.score}% match
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {p.years_experience != null ? `${p.years_experience} yrs` : ""}
                                {locationOf(p) ? ` · ${locationOf(p)}` : ""}
                                {load > 0 ? ` · ${load} active` : ""}
                              </span>
                            </div>
                            {mr.reasons.length > 0 && (
                              <p className="mt-1 text-xs text-muted-foreground">{mr.reasons.join(" · ")}</p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            disabled={submitting === p.user_id}
                            onClick={() => assign(p.user_id, selected.user_id)}
                          >
                            {submitting === p.user_id ? "Assigning…" : "Assign"}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: MenteeStatus }) {
  const cfg = {
    unmatched: { label: "Unmatched", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
    pending: { label: "Pending", cls: "bg-muted text-muted-foreground" },
    active: { label: "Active", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  }[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.cls}`}>{cfg.label}</span>
  );
}
