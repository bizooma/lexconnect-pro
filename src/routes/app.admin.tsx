import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Avatar } from "@/components/avatar";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { initialsOf, locationOf, type Profile } from "@/hooks/use-profiles";
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
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin")({
  component: Admin,
});

type Mentorship = {
  id: string;
  mentor_id: string;
  mentee_id: string;
  status: string;
  created_at: string;
};

function Admin() {
  const { isAdmin, checking } = useIsAdmin();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [mentorships, setMentorships] = useState<Mentorship[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [assignFor, setAssignFor] = useState<Profile | null>(null);
  const [selectedMentor, setSelectedMentor] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const [{ data: pData }, { data: mData }] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id,user_id,full_name,headline,firm,city,state,practice_areas,years_experience,bio,avatar_url,is_mentor,is_mentee,accepting_mentees",
        )
        .order("created_at", { ascending: false }),
      supabase.from("mentorships").select("id,mentor_id,mentee_id,status,created_at"),
    ]);
    setProfiles((pData as Profile[] | null) ?? []);
    setMentorships((mData as Mentorship[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin]);

  const mentors = useMemo(() => profiles.filter((p) => p.is_mentor), [profiles]);
  const profileByUser = useMemo(() => {
    const m = new Map<string, Profile>();
    profiles.forEach((p) => m.set(p.user_id, p));
    return m;
  }, [profiles]);

  const mentorshipsByMentee = useMemo(() => {
    const m = new Map<string, Mentorship[]>();
    mentorships.forEach((ms) => {
      const arr = m.get(ms.mentee_id) ?? [];
      arr.push(ms);
      m.set(ms.mentee_id, arr);
    });
    return m;
  }, [mentorships]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) =>
      [p.full_name, p.firm, p.headline, p.city, p.state]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(q)),
    );
  }, [profiles, query]);

  if (checking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/app/dashboard" />;

  const openAssign = (p: Profile) => {
    setAssignFor(p);
    setSelectedMentor("");
  };

  const submitAssign = async () => {
    if (!assignFor || !selectedMentor) return;
    if (selectedMentor === assignFor.user_id) {
      toast.error("Mentor and mentee can't be the same person");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("mentorships").insert({
      mentor_id: selectedMentor,
      mentee_id: assignFor.user_id,
      status: "active",
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Mentor assigned");
    setAssignFor(null);
    refresh();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
            Bar Association Admin
          </p>
          <h1 className="mt-1 font-serif text-2xl font-semibold text-foreground lg:text-3xl">
            Member directory
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profiles.length} member{profiles.length === 1 ? "" : "s"} ·{" "}
            {mentorships.length} mentorship{mentorships.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <Input
          placeholder="Search by name, firm, or location…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Location</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Roles</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">Mentor(s)</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Loading members…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No members found.
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const assigned = mentorshipsByMentee.get(p.user_id) ?? [];
              return (
                <tr key={p.id} className="transition hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        initials={initialsOf(p.full_name)}
                        size={32}
                        src={p.avatar_url}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {p.full_name ?? "Unnamed member"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.headline ?? p.firm ?? "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {locationOf(p) || "—"}
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {p.is_mentor && (
                        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-medium text-gold">
                          Mentor
                        </span>
                      )}
                      {p.is_mentee && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          Mentee
                        </span>
                      )}
                      {!p.is_mentor && !p.is_mentee && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                    {assigned.length === 0
                      ? "—"
                      : assigned
                          .map((ms) => profileByUser.get(ms.mentor_id)?.full_name ?? "Unknown")
                          .join(", ")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => openAssign(p)}>
                      Assign mentor
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!assignFor} onOpenChange={(o) => !o && setAssignFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign mentor</DialogTitle>
            <DialogDescription>
              Assign a mentor to{" "}
              <span className="font-medium text-foreground">
                {assignFor?.full_name ?? "this member"}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Mentor
            </label>
            <Select value={selectedMentor} onValueChange={setSelectedMentor}>
              <SelectTrigger>
                <SelectValue placeholder="Select a mentor…" />
              </SelectTrigger>
              <SelectContent>
                {mentors.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No members are registered as mentors yet.
                  </div>
                )}
                {mentors
                  .filter((m) => m.user_id !== assignFor?.user_id)
                  .map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.full_name ?? "Unnamed"}
                      {m.firm ? ` · ${m.firm}` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignFor(null)}>
              Cancel
            </Button>
            <Button onClick={submitAssign} disabled={!selectedMentor || submitting}>
              {submitting ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
