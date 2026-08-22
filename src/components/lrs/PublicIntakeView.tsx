import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicSponsorShell } from "@/components/website/PublicSponsorShell";
import { SiteBaseProvider } from "@/components/website/site-base";
import { PRACTICE_AREAS } from "@/lib/practice-areas";

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

const URGENCIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

function IntakeForm({
  orgId,
  orgName,
  customDisclaimer,
}: {
  orgId: string;
  orgName: string;
  customDisclaimer: string | null;
}) {
  const [areaOfLaw, setAreaOfLaw] = useState("");
  const [county, setCounty] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [narrative, setNarrative] = useState("");
  const [urgency, setUrgency] = useState("normal");
  const [language, setLanguage] = useState("English");
  const [company, setCompany] = useState(""); // honeypot — humans never fill this
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ intake_number: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (company.trim()) {
      setDone({ intake_number: "" }); // silently drop bot submissions
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("submit_referral_intake", {
      _org_id: orgId,
      _caller_name: name.trim(),
      _caller_email: email.trim(),
      _caller_phone: phone.trim(),
      _area_of_law: areaOfLaw,
      _county: county.trim(),
      _narrative: narrative.trim(),
      _urgency: urgency,
      _language_preference: language.trim() || "English",
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    const res = (data ?? {}) as { intake_number?: string };
    setDone({ intake_number: res.intake_number ?? "" });
  };

  if (done) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-medium">Your request has been received.</h2>
        {done.intake_number && (
          <p className="mt-2 text-sm">
            Your reference number is <span className="font-semibold">{done.intake_number}</span>.
          </p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          A member of the referral service will review your request and connect you with an attorney.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Area of law *</span>
          <select
            required
            value={areaOfLaw}
            onChange={(ev) => setAreaOfLaw(ev.target.value)}
            className={inputClass}
          >
            <option value="">Select an area…</option>
            {PRACTICE_AREAS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">County</span>
          <input value={county} onChange={(ev) => setCounty(ev.target.value)} maxLength={120} className={inputClass} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Your name *</span>
          <input
            required
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            maxLength={120}
            className={inputClass}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Email *</span>
          <input
            required
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            maxLength={255}
            className={inputClass}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Phone</span>
          <input
            type="tel"
            value={phone}
            onChange={(ev) => setPhone(ev.target.value)}
            maxLength={40}
            className={inputClass}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Urgency</span>
          <select value={urgency} onChange={(ev) => setUrgency(ev.target.value)} className={inputClass}>
            {URGENCIES.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Preferred language</span>
          <input
            value={language}
            onChange={(ev) => setLanguage(ev.target.value)}
            maxLength={60}
            className={inputClass}
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-muted-foreground">Brief description of your legal issue</span>
        <textarea
          rows={5}
          value={narrative}
          onChange={(ev) => setNarrative(ev.target.value)}
          maxLength={4000}
          className={inputClass}
        />
      </label>

      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Company
          <input tabIndex={-1} autoComplete="off" value={company} onChange={(ev) => setCompany(ev.target.value)} />
        </label>
      </div>

      <div className="rounded-md border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
        <p>
          This referral service is operated by {orgName}. Submitting a request does not create an attorney-client
          relationship and is not legal advice. If you are facing a deadline or emergency, contact an attorney directly
          or call 911. The referral service connects you with a participating attorney; it does not guarantee
          representation or any outcome.
        </p>
        {customDisclaimer && <p className="mt-2 whitespace-pre-line">{customDisclaimer}</p>}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {busy ? "Submitting…" : "Submit request"}
      </button>
    </form>
  );
}

export function PublicIntakeView({
  organization,
  brand,
  navPages,
  hasSponsors,
  hasEvents,
  paused,
  customDisclaimer,
  basePath,
}: {
  organization: { id: string; name: string; slug: string; logo_url: string | null };
  brand: any | null;
  navPages: Array<{ id: string; title: string; slug: string; nav_order: number }>;
  hasSponsors: boolean;
  hasEvents: boolean;
  paused: boolean;
  customDisclaimer: string | null;
  basePath: string;
}) {
  return (
    <SiteBaseProvider basePath={basePath}>
      <PublicSponsorShell
        organization={organization}
        brand={brand}
        navPages={navPages}
        hasSponsors={hasSponsors}
        hasEvents={hasEvents}
        hasReferralService
        currentSlug="find-a-lawyer"
      >
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold">Find a Lawyer</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tell us about your legal issue and {organization.name} will connect you with a participating attorney.
            </p>
          </div>
          {paused ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              This referral service is not available right now. Please check back later.
            </p>
          ) : (
            <IntakeForm
              orgId={organization.id}
              orgName={organization.name}
              customDisclaimer={customDisclaimer}
            />
          )}
        </div>
      </PublicSponsorShell>
    </SiteBaseProvider>
  );
}

export function publicIntakeMeta(orgName: string) {
  const title = `Find a Lawyer — ${orgName}`;
  const description = `Request a lawyer referral from ${orgName}. Tell us about your legal issue and we'll connect you with a participating attorney.`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}
