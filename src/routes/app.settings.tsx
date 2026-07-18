import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PRACTICE_AREAS } from "@/lib/mock-data";
import { Avatar } from "@/components/avatar";
import { PushNotificationsCard } from "@/components/push-notifications-card";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings")({
  component: Settings,
});

const COMM_OPTIONS = ["Messaging", "Voice Notes", "Video Calls", "Coffee Meetings"] as const;
const CADENCE_OPTIONS = ["Weekly", "Bi-weekly", "Monthly"] as const;

function Settings() {
  const { user, loading: authLoading } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const [role, setRole] = useState<"Mentor" | "Mentee" | "Both" | null>(null);
  const [fullName, setFullName] = useState("");
  const [headline, setHeadline] = useState("");
  const [firm, setFirm] = useState("");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [years, setYears] = useState("");
  const [barAdmissions, setBarAdmissions] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [practiceAreas, setPracticeAreas] = useState<string[]>([]);
  const [comm, setComm] = useState<string[]>([]);
  const [cadence, setCadence] = useState<string>("Bi-weekly");
  const [bio, setBio] = useState("");
  const [acceptingMentees, setAcceptingMentees] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setHeadline(data.headline ?? "");
        setFirm(data.firm ?? "");
        setCity(data.city ?? "");
        setStateRegion(data.state ?? "");
        setYears(data.years_experience ? String(data.years_experience) : "");
        setBarAdmissions((data.bar_admissions ?? []).join(", "));
        setLinkedin(data.linkedin_url ?? "");
        setPracticeAreas(data.practice_areas ?? []);
        setComm(data.communication_prefs ?? []);
        setCadence(data.meeting_cadence ?? "Bi-weekly");
        setBio(data.bio ?? "");
        setAcceptingMentees(data.accepting_mentees ?? false);
        setAvatarUrl(data.avatar_url ?? null);
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
    const bars = barAdmissions.split(",").map((s) => s.trim()).filter(Boolean);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName || null,
        headline: headline || null,
        firm: firm || null,
        city: city || null,
        state: stateRegion || null,
        years_experience: yearsNum,
        bar_admissions: bars,
        linkedin_url: linkedin || null,
        practice_areas: practiceAreas,
        communication_prefs: comm,
        meeting_cadence: cadence,
        bio: bio || null,
        is_mentor: isMentor,
        is_mentee: isMentee,
        accepting_mentees: isMentor && acceptingMentees,
      })
      .eq("user_id", user.id);

    setSaving(false);
    if (error) {
      toast.error("Could not save profile", { description: error.message });
      return;
    }
    toast.success("Profile updated");
  };

  if (authLoading || !loaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Account</p>
          <h1 className="mt-1 font-serif text-2xl font-semibold text-foreground lg:text-3xl">Profile settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Signed in as {user?.email}</p>
        </div>
        <Link to="/app/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Back</Link>
      </div>

      <Section title="Profile photo">
        <div className="flex items-center gap-5">
          <Avatar
            initials={(fullName || user?.email || "?").split(/[\s@]/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("")}
            src={avatarUrl}
            size={80}
          />
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !user) return;
                if (file.size > 5 * 1024 * 1024) {
                  toast.error("Image too large", { description: "Please choose an image under 5MB." });
                  return;
                }
                setUploading(true);
                const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
                const path = `${user.id}/avatar-${Date.now()}.${ext}`;
                const { error: upErr } = await supabase.storage
                  .from("avatars")
                  .upload(path, file, { upsert: true, contentType: file.type });
                if (upErr) {
                  setUploading(false);
                  toast.error("Upload failed", { description: upErr.message });
                  return;
                }
                const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
                const url = pub.publicUrl;
                const { error: updErr } = await supabase
                  .from("profiles")
                  .update({ avatar_url: url })
                  .eq("user_id", user.id);
                setUploading(false);
                if (updErr) {
                  toast.error("Could not save photo", { description: updErr.message });
                  return;
                }
                setAvatarUrl(url);
                toast.success("Profile photo updated");
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:border-primary/40 disabled:opacity-50"
            >{uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}</button>
            {avatarUrl && (
              <button
                type="button"
                disabled={uploading}
                onClick={async () => {
                  if (!user) return;
                  const { error } = await supabase
                    .from("profiles")
                    .update({ avatar_url: null })
                    .eq("user_id", user.id);
                  if (error) {
                    toast.error("Could not remove photo", { description: error.message });
                    return;
                  }
                  setAvatarUrl(null);
                  toast.success("Photo removed");
                }}
                className="ml-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
              >Remove</button>
            )}
            <p className="mt-2 text-xs text-muted-foreground">PNG or JPG, up to 5MB.</p>
          </div>
        </div>
      </Section>

      <Section title="Role">
        <div className="grid grid-cols-3 gap-2">
          {(["Mentor", "Mentee", "Both"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${role === r ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/40"}`}
            >{r}</button>
          ))}
        </div>
        {(role === "Mentor" || role === "Both") && (
          <label className="mt-4 flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={acceptingMentees}
              onChange={(e) => setAcceptingMentees(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Currently accepting new mentees
          </label>
        )}
      </Section>

      <Section title="Professional information">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" value={fullName} onChange={setFullName} />
          <Field label="Headline" value={headline} onChange={setHeadline} />
          <Field label="Law firm" value={firm} onChange={setFirm} />
          <Field label="LinkedIn URL" value={linkedin} onChange={setLinkedin} />
          <Field label="City" value={city} onChange={setCity} />
          <Field label="State" value={stateRegion} onChange={setStateRegion} />
          <Field label="Years of experience" value={years} onChange={setYears} type="number" />
          <div className="sm:col-span-2">
            <Field label="Bar admissions (comma separated)" value={barAdmissions} onChange={setBarAdmissions} />
          </div>
        </div>
      </Section>

      <Section title="Practice areas">
        <div className="flex flex-wrap gap-2">
          {PRACTICE_AREAS.map((p) => (
            <Chip key={p} label={p} active={practiceAreas.includes(p)} onClick={() => toggle(p, practiceAreas, setPracticeAreas)} />
          ))}
        </div>
      </Section>

      <Section title="Availability & communication">
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
        <p className="mt-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Preferred communication</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {COMM_OPTIONS.map((c) => (
            <Chip key={c} label={c} active={comm.includes(c)} onClick={() => toggle(c, comm, setComm)} />
          ))}
        </div>
      </Section>

      <Section title="Bio">
        <textarea
          rows={6}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="A short professional bio…"
          className="block w-full rounded-xl border border-input bg-card p-4 text-sm leading-relaxed text-foreground shadow-card outline-none ring-ring/30 focus:ring-2"
        />
      </Section>

      <PushNotificationsCard userId={user?.id} />

      <section className="mt-8 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-serif text-base font-semibold text-foreground">Community Q&amp;A notifications</h2>
        <p className="mt-1 text-xs text-muted-foreground">Choose how often the discussion board pings you.</p>
        <Link to="/app/qa/notifications" className="mt-3 inline-flex rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
          Manage preferences
        </Link>
      </section>

      <div className="sticky bottom-0 -mx-4 mt-8 border-t border-border bg-background/95 px-4 py-4 backdrop-blur lg:-mx-8 lg:px-8">
        <div className="flex justify-end gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant transition hover:bg-primary/90 disabled:opacity-50"
          >{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </div>

      
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-card lg:p-6">
      <h2 className="font-serif text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
