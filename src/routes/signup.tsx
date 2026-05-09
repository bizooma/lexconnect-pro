import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Logo } from "@/components/logo";
import { supabase } from "@/integrations/supabase/client";
import { PasswordInput } from "@/components/password-input";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  component: SignupOrg,
});

const ORG_KINDS = [
  { value: "bar_association", label: "Bar Association" },
  { value: "firm", label: "Law Firm" },
  { value: "firm", label: "Legal Nonprofit" },
  { value: "firm", label: "Law School" },
  { value: "firm", label: "Attorney Group" },
  { value: "firm", label: "Other" },
] as const;

const PLANS = [
  { id: "starter", name: "Community", seats: 25, price: "$99/mo", blurb: "Up to 25 members" },
  { id: "pro", name: "Growth", seats: 100, price: "$299/mo", blurb: "Up to 100 members" },
  { id: "firm", name: "Scale", seats: 250, price: "$699/mo", blurb: "Up to 250 members" },
  { id: "firm", name: "Enterprise", seats: 9999, price: "Let's talk", blurb: "Unlimited seats + onboarding" },
] as const;

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "org";
}

function SignupOrg() {
  const navigate = useNavigate();
  const [step, setStep] = useState<0 | 1 | 2>(0);

  const [orgName, setOrgName] = useState("");
  const [orgKindLabel, setOrgKindLabel] = useState<string>("Bar Association");
  const [estSeats, setEstSeats] = useState("25");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [planIdx, setPlanIdx] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slug = useMemo(() => slugify(orgName), [orgName]);
  const orgKindValue = ORG_KINDS.find((k) => k.label === orgKindLabel)?.value ?? "firm";

  const finish = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // Sign up the admin
      const { data: signUp, error: signErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/app/dashboard`,
          data: { full_name: fullName },
        },
      });
      if (signErr) throw signErr;

      // If email confirmation is required there's no session — sign in immediately if possible
      if (!signUp.session) {
        const { error: pwErr } = await supabase.auth.signInWithPassword({ email, password });
        if (pwErr) {
          toast.success("Check your email to confirm, then sign in to finish setting up your organization.");
          navigate({ to: "/login" });
          return;
        }
      }

      const plan = PLANS[planIdx];
      const planValue = plan.id as "starter" | "pro" | "firm";
      const { data: orgId, error: rpcErr } = await supabase.rpc("create_organization_with_owner", {
        _name: orgName,
        _slug: slug,
        _kind: orgKindValue,
        _plan: planValue,
        _max_users: plan.seats,
      });
      if (rpcErr) throw rpcErr;

      if (typeof window !== "undefined" && orgId) {
        window.localStorage.setItem("lexguild.currentOrgId", orgId as unknown as string);
      }
      toast.success("Organization created");
      navigate({ to: "/onboarding" });
    } catch (err: any) {
      setError(err.message ?? "Could not create your organization.");
    } finally {
      setSubmitting(false);
    }
  };

  const canNext0 = orgName.trim().length > 1 && estSeats;
  const canNext1 = fullName.trim() && email.trim() && password.length >= 6;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-5 py-5">
        <Logo />
        <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-5 pb-12">
        <div className="mb-6 flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>

        {step === 0 && (
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">Create your legal community</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Launch a private mentorship and professional development network for your legal organization.
            </p>
            <div className="mt-6 space-y-4">
              <Field label="Organization name" placeholder="Jacksonville Bar Association" value={orgName} onChange={setOrgName} />
              {orgName && (
                <p className="text-xs text-muted-foreground">URL: <span className="font-mono text-foreground">lexguild.com/org/{slug}</span></p>
              )}
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">Organization type</label>
                <select value={orgKindLabel} onChange={(e) => setOrgKindLabel(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground shadow-card outline-none ring-ring/30 focus:ring-2">
                  {ORG_KINDS.map((k) => <option key={k.label} value={k.label}>{k.label}</option>)}
                </select>
              </div>
              <Field label="Estimated member count" placeholder="25" value={estSeats} onChange={setEstSeats} type="number" />
            </div>
            <Footer onBack={() => navigate({ to: "/" })} backLabel="Cancel" onNext={() => setStep(1)} disabled={!canNext0} />
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">Your admin account</h1>
            <p className="mt-2 text-sm text-muted-foreground">You'll be the owner and billing administrator for this organization.</p>
            <div className="mt-6 space-y-4">
              <Field label="Full name" placeholder="Jane Doe, Esq." value={fullName} onChange={setFullName} />
              <Field label="Work email" placeholder="you@firm.com" value={email} onChange={setEmail} type="email" />
              <Field label="Password" placeholder="At least 6 characters" value={password} onChange={setPassword} type="password" />
            </div>
            <Footer onBack={() => setStep(0)} onNext={() => setStep(2)} disabled={!canNext1} />
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">Choose a plan</h1>
            <p className="mt-2 text-sm text-muted-foreground">Only the organization pays. Members never enter payment information.</p>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PLANS.map((p, i) => (
                <button key={p.name} onClick={() => setPlanIdx(i)}
                  className={`rounded-2xl border bg-card p-5 text-left shadow-card transition ${planIdx === i ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"}`}>
                  <p className="font-serif text-lg font-semibold text-foreground">{p.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{p.blurb}</p>
                  <p className="mt-3 text-sm font-medium text-primary">{p.price}</p>
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Billing isn't connected yet — you'll start in trial mode and can add payment details later.
            </p>
            {error && <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">{error}</div>}
            <Footer onBack={() => setStep(1)} onNext={finish} nextLabel={submitting ? "Creating…" : "Create organization"} disabled={submitting} />
          </div>
        )}
      </main>
    </div>
  );
}

function Field({ label, placeholder, value, onChange, type = "text" }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  const inputClass = "mt-1.5 block w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground shadow-card outline-none ring-ring/30 focus:ring-2";
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {type === "password" ? (
        <PasswordInput value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} />
      )}
    </label>
  );
}

function Footer({ onBack, onNext, backLabel = "Back", nextLabel = "Continue", disabled }: {
  onBack: () => void; onNext: () => void; backLabel?: string; nextLabel?: string; disabled?: boolean;
}) {
  return (
    <div className="mt-8 flex items-center justify-between">
      <button onClick={onBack} className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">{backLabel}</button>
      <button onClick={onNext} disabled={disabled}
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant transition hover:bg-primary/90 disabled:opacity-50">
        {nextLabel}
      </button>
    </div>
  );
}
