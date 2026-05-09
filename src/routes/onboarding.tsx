import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { INTERESTS, PRACTICE_AREAS } from "@/lib/mock-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding — LexGuild" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Onboarding,
});

const STEPS = ["Role", "Profile", "Interests", "Availability", "Bio"] as const;
const COMM_OPTIONS = ["Messaging", "Voice Notes", "Video Calls", "Coffee Meetings"] as const;
const CADENCE_OPTIONS = ["Weekly", "Bi-weekly", "Monthly"] as const;

function Onboarding() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [role, setRole] = useState<"Mentor" | "Mentee" | "Both" | null>(null);
  const [fullName, setFullName] = useState("");
  const [firm, setFirm] = useState("");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [years, setYears] = useState("");
  const [barAdmissions, setBarAdmissions] = useState("");
  const [headline, setHeadline] = useState("");
  const [practiceAreas, setPracticeAreas] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [comm, setComm] = useState<string[]>([]);
  const [cadence, setCadence] = useState<string>("Bi-weekly");
  const [bio, setBio] = useState("");

  // Redirect if not signed in
  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  // Hydrate existing profile
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setFullName(data.full_name ?? "");
        setFirm(data.firm ?? "");
        setCity(data.city ?? "");
        setStateRegion(data.state ?? "");
        setYears(data.years_experience ? String(data.years_experience) : "");
        setBarAdmissions((data.bar_admissions ?? []).join(", "));
        setHeadline(data.headline ?? "");
        setPracticeAreas(data.practice_areas ?? []);
        setComm(data.communication_prefs ?? []);
        setCadence(data.meeting_cadence ?? "Bi-weekly");
        setBio(data.bio ?? "");
        if (data.is_mentor && data.is_mentee) setRole("Both");
        else if (data.is_mentor) setRole("Mentor");
        else if (data.is_mentee) setRole("Mentee");
      }
      setLoaded(true);
    })();
  }, [user]);

  const toggle = (s: string, list: string[], setter: (v: string[]) => void) =>
    setter(list.includes(s) ? list.filter((i) => i !== s) : [...list, s]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const isMentor = role === "Mentor" || role === "Both";
    const isMentee = role === "Mentee" || role === "Both";
    const yearsNum = years ? parseInt(years, 10) : null;
    const bars = barAdmissions
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName || null,
        firm: firm || null,
        city: city || null,
        state: stateRegion || null,
        years_experience: yearsNum,
        bar_admissions: bars,
        headline: headline || null,
        practice_areas: practiceAreas,
        communication_prefs: comm,
        meeting_cadence: cadence,
        bio: bio || null,
        is_mentor: isMentor,
        is_mentee: isMentee,
        accepting_mentees: isMentor,
        onboarded: true,
      })
      .eq("user_id", user.id);

    setSaving(false);
    if (error) {
      toast.error("Could not save profile", { description: error.message });
      return;
    }
    toast.success("Profile saved");
    navigate({ to: "/app/dashboard" });
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else save();
  };
  const back = () => step > 0 && setStep(step - 1);

  if (authLoading || !loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-5 py-4">
        <Logo />
        <button onClick={() => navigate({ to: "/app/dashboard" })} className="text-sm text-muted-foreground hover:text-foreground">Skip</button>
      </header>

      <div className="px-5">
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>
        <p className="mt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>
      </div>

      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-8">
        {step === 0 && (
          <div>
            <h1 className="font-serif text-2xl font-semibold text-foreground">How do you plan to participate?</h1>
            <p className="mt-1 text-sm text-muted-foreground">You can change this any time from your profile.</p>
            <div className="mt-6 space-y-3">
              {(["Mentor", "Mentee", "Both"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`w-full rounded-2xl border bg-card p-5 text-left shadow-card transition ${role === r ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"}`}
                >
                  <p className="font-serif text-lg font-semibold text-foreground">{r}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {r === "Mentor" && "Share your experience with newer attorneys."}
                    {r === "Mentee" && "Find guidance from senior counsel in your practice."}
                    {r === "Both" && "Mentor others while learning from peers and seniors."}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="font-serif text-2xl font-semibold text-foreground">Professional information</h1>
            <p className="mt-1 text-sm text-muted-foreground">This helps us match you with the right people.</p>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name" placeholder="Christopher Hale" value={fullName} onChange={setFullName} />
              <Field label="Headline" placeholder="Litigation partner & mentor" value={headline} onChange={setHeadline} />
              <Field label="Law firm" placeholder="Hale & Associates" value={firm} onChange={setFirm} />
              <Field label="City" placeholder="Austin" value={city} onChange={setCity} />
              <Field label="State" placeholder="TX" value={stateRegion} onChange={setStateRegion} />
              <Field label="Years of experience" placeholder="8" value={years} onChange={setYears} type="number" />
              <div className="sm:col-span-2">
                <Field label="Bar admissions (comma separated)" placeholder="Texas State Bar, NY State Bar" value={barAdmissions} onChange={setBarAdmissions} />
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Practice areas</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRACTICE_AREAS.map((p) => (
                    <Chip key={p} label={p} active={practiceAreas.includes(p)} onClick={() => toggle(p, practiceAreas, setPracticeAreas)} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="font-serif text-2xl font-semibold text-foreground">What do you want to focus on?</h1>
            <p className="mt-1 text-sm text-muted-foreground">Pick a few — we'll suggest matches around them.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {INTERESTS.map((i) => (
                <Chip key={i} label={i} active={interests.includes(i)} onClick={() => toggle(i, interests, setInterests)} />
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="font-serif text-2xl font-semibold text-foreground">How often, and how?</h1>
            <p className="mt-1 text-sm text-muted-foreground">Set the cadence that fits your week.</p>
            <div className="mt-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cadence</p>
              <div className="mt-2 flex gap-2">
                {CADENCE_OPTIONS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCadence(c)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${cadence === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/40"}`}
                  >{c}</button>
                ))}
              </div>
            </div>
            <div className="mt-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Preferred communication</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {COMM_OPTIONS.map((c) => (
                  <Chip key={c} label={c} active={comm.includes(c)} onClick={() => toggle(c, comm, setComm)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h1 className="font-serif text-2xl font-semibold text-foreground">Tell us about yourself</h1>
            <p className="mt-1 text-sm text-muted-foreground">A short professional bio. You can edit later.</p>
            <textarea
              rows={6}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Eight years in mid-market business litigation…"
              className="mt-4 block w-full rounded-xl border border-input bg-card p-4 text-sm leading-relaxed text-foreground shadow-card outline-none ring-ring/30 focus:ring-2"
            />
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 border-t border-border bg-background/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <button
            onClick={back}
            disabled={step === 0 || saving}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
          >Back</button>
          <button
            onClick={next}
            disabled={(step === 0 && !role) || saving}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant transition hover:bg-primary/90 disabled:opacity-50"
          >{saving ? "Saving…" : step === STEPS.length - 1 ? "Finish & enter dashboard" : "Continue"}</button>
        </div>
      </footer>
    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 block w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground shadow-card outline-none ring-ring/30 focus:ring-2"
      />
    </label>
  );
}

function Chip({ label, active = false, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/40"}`}
    >{label}</button>
  );
}
