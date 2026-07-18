import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Logo } from "@/components/logo";
import { supabase } from "@/integrations/supabase/client";
import { PasswordInput } from "@/components/password-input";
import { toast } from "sonner";

type PlanId = "starter" | "professional" | "enterprise" | "test";
type SignupSearch = { plan?: PlanId; billing?: "monthly" | "annual" };

function isPlanId(value: unknown): value is PlanId {
  return value === "starter" || value === "professional" || value === "enterprise" || value === "test";
}

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Start your organization — LexGuild" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): SignupSearch => ({
    plan: isPlanId(search.plan) ? search.plan : undefined,
    billing: search.billing === "annual" ? "annual" : search.billing === "monthly" ? "monthly" : undefined,
  }),
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

type Plan = {
  id: PlanId;
  name: string;
  seats: number;
  monthly: string;
  annual: string;
  monthlySub?: string;
  annualSub?: string;
  blurb: string;
  contactOnly?: boolean;
};

const PLANS_BY_ID: Record<PlanId, Plan> = {
  test: {
    id: "test",
    name: "Test",
    seats: 1,
    monthly: "$1/mo",
    annual: "$1/mo",
    blurb: "Test subscription workflow",
  },
  starter: {
    id: "starter",
    name: "Starter",
    seats: 25,
    monthly: "$399/mo",
    annual: "$3,990/yr",
    annualSub: "$399/mo billed annually",
    blurb: "Up to 25 members · Pilot programs & small firms",
  },
  professional: {
    id: "professional",
    name: "Professional",
    seats: 100,
    monthly: "$899/mo",
    annual: "$8,990/yr",
    annualSub: "$899/mo billed annually",
    blurb: "Up to 100 members · Mid-sized bars, regional groups, larger firms",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    seats: 9999,
    monthly: "Custom",
    annual: "Custom",
    monthlySub: "From $1,500/mo",
    annualSub: "From $1,500/mo",
    blurb: "250+ members · State bars, multi-location firms, law schools",
    contactOnly: true,
  },
};

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    seats: 25,
    monthly: "$399/mo",
    annual: "$3,990/yr",
    annualSub: "$399/mo billed annually",
    blurb: "Up to 25 members · Pilot programs & small firms",
  },
  {
    id: "professional",
    name: "Professional",
    seats: 100,
    monthly: "$899/mo",
    annual: "$8,990/yr",
    annualSub: "$899/mo billed annually",
    blurb: "Up to 100 members · Mid-sized bars, regional groups, larger firms",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    seats: 9999,
    monthly: "Custom",
    annual: "Custom",
    monthlySub: "From $1,500/mo",
    annualSub: "From $1,500/mo",
    blurb: "250+ members · State bars, multi-location firms, law schools",
    contactOnly: true,
  },
];

function priceIdForPlan(plan: Plan, billing: "monthly" | "annual") {
  if (plan.id === "test") return "test_monthly";
  return `${plan.id}_${billing}`;
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "org";
}

function SignupOrg() {
  const navigate = useNavigate();
  const { plan: planParam, billing: billingParam } = Route.useSearch();
  const initialPlanIdx = planParam === "starter" ? 0 : planParam === "enterprise" ? 2 : planParam === "professional" ? 1 : 1;
  const tierWasPreselected = Boolean(planParam);
  const [step, setStep] = useState<0 | 1 | 2>(0);

  const [orgName, setOrgName] = useState("");
  const [orgKindLabel, setOrgKindLabel] = useState<string>("Bar Association");
  const [estSeats, setEstSeats] = useState(
    planParam === "professional" ? "100" : planParam === "enterprise" ? "250" : "25"
  );

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [planIdx, setPlanIdx] = useState<number>(initialPlanIdx);
  const [billing, setBilling] = useState<"monthly" | "annual">(billingParam ?? "monthly");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slug = useMemo(() => slugify(orgName), [orgName]);
  const orgKindValue = ORG_KINDS.find((k) => k.label === orgKindLabel)?.value ?? "firm";
  const selectedPlan = isPlanId(planParam) ? PLANS_BY_ID[planParam] : PLANS[planIdx];

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

      const plan = selectedPlan;
      const planValue: "starter" | "pro" | "firm" =
        plan.id === "professional" ? "pro" : plan.id === "enterprise" ? "firm" : "starter";
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
      if (plan.contactOnly) {
        navigate({ to: "/onboarding" });
      } else {
        const priceId = priceIdForPlan(plan, billing);
        navigate({ to: "/checkout", search: { price: priceId } });
      }
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
        <Link to="/login" search={{ next: undefined }} className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
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
                <label htmlFor="org-kind" className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">Organization type</label>
                <select id="org-kind" value={orgKindLabel} onChange={(e) => setOrgKindLabel(e.target.value)}
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
            <Footer
              onBack={() => setStep(0)}
              onNext={() => {
                if (tierWasPreselected && selectedPlan && !selectedPlan.contactOnly) void finish();
                else setStep(2);
              }}
              nextLabel={
                tierWasPreselected && selectedPlan && !selectedPlan.contactOnly
                  ? submitting
                    ? "Creating…"
                    : "Create organization"
                  : "Continue"
              }
              disabled={!canNext1 || submitting}
            />
            {error && <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">{error}</div>}
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">Choose a plan</h1>
            <p className="mt-2 text-sm text-muted-foreground">Only the organization pays. Members never enter payment information.</p>

            <div className="mt-6 flex flex-col items-center gap-2">
              <div className="inline-flex items-center rounded-full border border-border bg-card p-1 shadow-card">
                <button
                  type="button"
                  onClick={() => setBilling("monthly")}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    billing === "monthly" ? "bg-primary text-primary-foreground shadow-elegant" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBilling("annual")}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    billing === "annual" ? "bg-primary text-primary-foreground shadow-elegant" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Annual
                </button>
              </div>
              <span className="text-xs font-medium text-gold">Save 2 months with annual billing</span>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {PLANS.map((p, i) => {
                const price = billing === "monthly" ? p.monthly : p.annual;
                const sub = billing === "monthly" ? p.monthlySub : p.annualSub;
                return (
                  <button
                    key={p.name}
                    onClick={() => setPlanIdx(i)}
                    className={`flex flex-col rounded-2xl border bg-card p-5 text-left shadow-card transition ${
                      planIdx === i ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <p className="font-serif text-lg font-semibold text-foreground">{p.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{p.blurb}</p>
                    <p className="mt-3 text-sm font-semibold text-primary">{price}</p>
                    {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {selectedPlan?.contactOnly
                ? "Enterprise plans are tailored — we'll reach out within one business day to scope onboarding."
                : "After creating your organization, you'll continue to secure checkout to activate billing."}
            </p>
            {error && <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">{error}</div>}
            <Footer
              onBack={() => setStep(1)}
              onNext={finish}
              nextLabel={submitting ? "Creating…" : selectedPlan?.contactOnly ? "Request Enterprise" : "Create organization"}
              disabled={submitting}
            />
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
      <button type="button" onClick={onBack} className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">{backLabel}</button>
      <button type="button" onClick={onNext} disabled={disabled}
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant transition hover:bg-primary/90 disabled:opacity-50">
        {nextLabel}
      </button>
    </div>
  );
}
