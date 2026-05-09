import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PRACTICE_AREAS } from "@/lib/mock-data";
import { Avatar } from "@/components/avatar";
import { useDirectory, initialsOf, locationOf, type Profile } from "@/hooks/use-profiles";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/app/discover")({
  component: Discover,
});

function Discover() {
  const { user } = useAuth();
  const { currentOrgId } = useCurrentOrg();
  const { profiles, loading } = useDirectory();
  const [q, setQ] = useState("");
  const [practice, setPractice] = useState<string | null>(null);
  const [requested, setRequested] = useState<Profile | null>(null);
  const [intro, setIntro] = useState(
    "Hi — I'd love to connect and learn from your practice. Would you be open to a brief intro call this month?",
  );
  const [submitting, setSubmitting] = useState(false);
  const [existingMentorIds, setExistingMentorIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    supabase
      .from("mentorships")
      .select("mentor_id,status")
      .eq("mentee_id", user.id)
      .then(({ data }) => {
        setExistingMentorIds(new Set((data ?? []).map((r: any) => r.mentor_id)));
      });
  }, [user]);

  const sendRequest = async () => {
    if (!user || !requested) return;
    if (!currentOrgId) { toast.error("No organization selected"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("mentorships").insert({
      mentor_id: requested.user_id,
      mentee_id: user.id,
      status: "pending",
      intro_message: intro.trim() || null,
      organization_id: currentOrgId,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Mentorship request sent");
    setExistingMentorIds((prev) => new Set(prev).add(requested.user_id));
    setRequested(null);
  };

  const filtered = useMemo(() => {
    return profiles.filter((p) => {
      if (practice && !(p.practice_areas ?? []).includes(practice)) return false;
      if (q) {
        const hay = `${p.full_name ?? ""} ${p.firm ?? ""} ${p.bio ?? ""} ${(p.practice_areas ?? []).join(" ")}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [profiles, practice, q]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-10">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground lg:text-3xl">Discover</h1>
        <p className="mt-1 text-sm text-muted-foreground">Find mentors and mentees by practice, location, and interests.</p>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3" strokeLinecap="round"/></svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, firm, or interest"
            className="block w-full rounded-lg border border-input bg-card py-2.5 pl-10 pr-3.5 text-sm text-foreground shadow-card outline-none ring-ring/30 focus:ring-2"
          />
        </div>
      </div>

      <div className="mt-3 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0 lg:flex-wrap">
        <FilterChip label="All" active={practice === null} onClick={() => setPractice(null)} />
        {PRACTICE_AREAS.map((p) => (
          <FilterChip key={p} label={p} active={practice === p} onClick={() => setPractice(p)} />
        ))}
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading members…</p>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
          <p className="font-medium text-foreground">No members match your filters yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {profiles.length === 0
              ? "Invite colleagues to LexGuild to start building your community."
              : "Try clearing the search or selecting a different practice area."}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const primary = p.practice_areas?.[0];
            const loc = locationOf(p);
            return (
              <article key={p.id} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-card transition hover:shadow-elegant">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar initials={initialsOf(p.full_name)} size={44} />
                    <div>
                      <p className="font-medium text-foreground">{p.full_name || "Member"}</p>
                      <p className="text-xs text-muted-foreground">{p.firm || p.headline || "Attorney"}</p>
                    </div>
                  </div>
                  {p.is_mentor && (
                    <span className="rounded-full bg-gold/15 px-2 py-1 text-[10px] font-semibold text-gold">Mentor</span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {primary && <Tag>{primary}</Tag>}
                  {loc && <Tag>{loc}</Tag>}
                  {p.years_experience != null && <Tag>{p.years_experience} yrs</Tag>}
                </div>

                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {p.bio || "No bio yet."}
                </p>

                {p.practice_areas && p.practice_areas.length > 1 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.practice_areas.slice(1, 3).map((i) => <Tag key={i} subtle>{i}</Tag>)}
                  </div>
                )}

                <div className="mt-auto pt-4">
                  {existingMentorIds.has(p.user_id) ? (
                    <button
                      disabled
                      className="w-full rounded-lg bg-muted px-3 py-2 text-xs font-medium text-muted-foreground"
                    >Request sent</button>
                  ) : (
                    <button
                      onClick={() => { setIntro("Hi — I'd love to connect and learn from your practice. Would you be open to a brief intro call this month?"); setRequested(p); }}
                      className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-elegant hover:bg-primary/90"
                    >Request mentorship</button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {requested && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-primary/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setRequested(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-t-2xl bg-card shadow-elegant sm:rounded-2xl">
            <div className="border-b border-border px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Mentorship request</p>
              <h3 className="mt-1 font-serif text-lg font-semibold text-foreground">Reach out to {requested.full_name || "this member"}</h3>
            </div>
            <div className="p-5">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">Short introduction</label>
              <textarea
                rows={5}
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-input bg-background p-3 text-sm leading-relaxed text-foreground outline-none ring-ring/30 focus:ring-2"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-border bg-background/50 px-5 py-3">
              <button onClick={() => setRequested(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Cancel</button>
              <button
                onClick={sendRequest}
                disabled={submitting}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-elegant hover:bg-primary/90 disabled:opacity-60"
              >{submitting ? "Sending…" : "Send request"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/40"}`}>{label}</button>
  );
}
function Tag({ children, subtle = false }: { children: React.ReactNode; subtle?: boolean }) {
  return <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${subtle ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>{children}</span>;
}
