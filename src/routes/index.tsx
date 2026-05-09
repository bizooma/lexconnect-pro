import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/logo";
import heroBg from "@/assets/hero-bg.jpg";
import phoneMockup from "@/assets/lex-phones.png";
import bizoomaLogo from "@/assets/bizooma-logo.png";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [submitting, setSubmitting] = useState(false);
  const [contactStatus, setContactStatus] = useState<null | "success" | "error">(null);
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground sm:flex">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#install" className="hover:text-foreground">Install</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <a href="#contact" className="hover:text-foreground">Contact</a>
          <Link to="/login" className="text-foreground hover:text-primary">Sign in</Link>
        </nav>
        <Link
          to="/login"
          className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-elegant transition-colors hover:bg-primary/90 sm:hidden"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <img
          src={heroBg}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/85 to-background/40 lg:from-background/95 lg:via-background/70 lg:to-background/20" />
        <div className="mx-auto max-w-6xl px-5 pt-8 pb-16 sm:pt-16 sm:pb-24">
        <div className="grid items-end gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-card">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              An invitation-only network for the legal profession
            </span>
            <h1 className="mt-5 font-serif text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-[3.75rem]">
              Modern Mentorship<br />
              <span className="text-primary">for the Legal Profession</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              LexGuild helps bar associations, law firms, and legal organizations build stronger attorney mentorship programs through structured communication, professional development, and meaningful member engagement.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-elegant transition hover:bg-primary/90"
              >
                Start your organization
              </Link>
              <Link
                to="/join"
                className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition hover:bg-accent"
              >
                I have an invite code
              </Link>
            </div>
          </div>

          {/* Phone preview */}
          <div className="relative mx-auto w-full max-w-lg self-end -mb-16 sm:-mb-24">
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-navy opacity-20 blur-2xl" />
            <img
              src={phoneMockup}
              alt="LexGuild mobile app preview"
              className="w-full h-auto"
            />
          </div>
        </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-gradient-navy">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { t: "Curated mentor matching", d: "Pair mentors and mentees by practice area, jurisdiction, and career stage — no random listserv assignments." },
            { t: "Voice notes built in", d: "Busy attorneys talk faster than they type. Send 30-second voice notes inside any conversation." },
            { t: "Lightweight scheduling", d: "Suggest times, attach Zoom or Meet links, and get gentle reminders the day before." },
            { t: "Guided conversations", d: "Optional prompts keep mentorships meaningful — even during the busiest filing weeks." },
            { t: "Community insights", d: "Bar associations see active mentorships, engagement, and most-active practice areas at a glance." },
            { t: "Built to scale", d: "Foundation for CLE, leadership groups, and practice-area communities as your network grows." },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-white/15 bg-white/10 p-6 shadow-elegant backdrop-blur-xl backdrop-saturate-150 ring-1 ring-inset ring-white/10 transition hover:bg-white/15 hover:border-white/25">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gold/15 text-gold ring-1 ring-gold/30">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <h3 className="font-serif text-lg font-semibold text-primary-foreground">{f.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/70">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Install the app */}
      <section id="install" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-card">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              Install LexGuild on your phone
            </span>
            <h2 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Add LexGuild to your home screen
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              LexGuild installs as a lightweight app — no App Store, no Play Store, no updates to manage. Open it like any other app on your phone.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {/* iOS */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-navy text-gold">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M16.365 1.43c0 1.14-.464 2.23-1.218 3.012-.836.86-2.21 1.522-3.319 1.43-.13-1.122.42-2.27 1.171-3.04.84-.85 2.282-1.49 3.366-1.402zM20.5 17.36c-.55 1.27-.815 1.84-1.527 2.96-.99 1.56-2.39 3.5-4.12 3.51-1.54.02-1.94-1-4.03-.99-2.09.01-2.53 1.01-4.07.99-1.74-.02-3.06-1.77-4.05-3.33C-.07 16.7-.36 12 1.94 9.6c1.55-1.61 3.97-2.55 6.04-2.59 1.57-.03 3.05.85 4.03.85.97 0 2.78-1.05 4.7-.9.8.04 3.06.32 4.51 2.45-3.97 2.18-3.32 7.86 1.28 7.95z"/></svg>
                </div>
                <h3 className="font-serif text-xl font-semibold text-foreground">iPhone & iPad</h3>
              </div>
              <ol className="mt-6 space-y-4">
                {[
                  { t: "Open LexGuild in Safari", d: "Installation only works from Safari on iOS — not Chrome or Firefox." },
                  { t: "Tap the Share button", d: "It's the square with an arrow pointing up at the bottom of the screen." },
                  { t: 'Choose "Add to Home Screen"', d: "Scroll down in the share sheet if you don't see it right away." },
                  { t: 'Tap "Add" to confirm', d: "LexGuild will appear on your home screen like any other app." },
                ].map((s, i) => (
                  <li key={s.t} className="flex gap-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-sm font-semibold text-primary-foreground">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.t}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{s.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Android */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-navy text-gold">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M17.6 9.48l1.84-3.18a.4.4 0 10-.69-.4l-1.86 3.23a11.7 11.7 0 00-9.78 0L5.25 5.9a.4.4 0 10-.69.4l1.84 3.18A10.5 10.5 0 001 18h22a10.5 10.5 0 00-5.4-8.52zM7 15.25a.94.94 0 110-1.88.94.94 0 010 1.88zm10 0a.94.94 0 110-1.88.94.94 0 010 1.88z"/></svg>
                </div>
                <h3 className="font-serif text-xl font-semibold text-foreground">Android</h3>
              </div>
              <ol className="mt-6 space-y-4">
                {[
                  { t: "Open LexGuild in Chrome", d: "Chrome offers the smoothest install experience on Android." },
                  { t: 'Look for the "Install app" prompt', d: "Chrome usually shows a banner at the bottom — tap Install." },
                  { t: "Or use the menu", d: 'Tap the three-dot menu in the top right and choose "Install app" or "Add to Home screen".' },
                  { t: "Confirm and launch", d: "LexGuild installs to your home screen and app drawer." },
                ].map((s, i) => (
                  <li key={s.t} className="flex gap-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-sm font-semibold text-primary-foreground">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.t}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{s.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border bg-card/50">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-card">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              Pricing
            </span>
            <h2 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Plans that grow with your organization
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Transparent pricing for bar associations, law firms, and legal organizations. Only the organization pays — members never enter payment information.
            </p>

            {/* Billing toggle */}
            <div className="mt-8 flex flex-col items-center gap-2">
              <div className="inline-flex items-center rounded-full border border-border bg-card p-1 shadow-card">
                <button
                  type="button"
                  onClick={() => setBilling("monthly")}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    billing === "monthly"
                      ? "bg-primary text-primary-foreground shadow-elegant"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBilling("annual")}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    billing === "annual"
                      ? "bg-primary text-primary-foreground shadow-elegant"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Annual
                </button>
              </div>
              <span className="text-xs font-medium text-gold">Save 2 months with annual billing</span>
            </div>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {[
              {
                name: "Starter",
                monthly: { price: "$399", period: "/mo", sub: null as string | null },
                annual: { price: "$3,990", period: "/yr", sub: "$399/mo billed annually" },
                blurb: "For pilot mentorship programs, small bar sections, and small firms getting started.",
                features: [
                  "Up to 25 members",
                  "1 organization admin",
                  "Invite links & codes",
                  "Messaging",
                  "Mentorship matching",
                  "Meeting scheduling",
                  "Mobile PWA access",
                  "Basic analytics",
                ],
                cta: "Start your organization",
                href: "/signup",
                featured: false,
              },
              {
                name: "Professional",
                monthly: { price: "$899", period: "/mo", sub: null as string | null },
                annual: { price: "$8,990", period: "/yr", sub: "$899/mo billed annually" },
                blurb: "For mid-sized bar associations, regional legal groups, and larger firms.",
                features: [
                  "Up to 100 members",
                  "Multiple admins",
                  "Admin matching controls",
                  "Voice notes",
                  "Organization branding",
                  "Mentorship reporting",
                  "Enhanced analytics",
                  "Priority support",
                ],
                cta: "Start your organization",
                href: "/signup",
                featured: true,
              },
              {
                name: "Enterprise",
                monthly: { price: "Custom", period: "", sub: "From $2,500/mo" },
                annual: { price: "Custom", period: "", sub: "From $2,500/mo" },
                blurb: "For state bar associations, multi-location firms, and law school systems.",
                features: [
                  "250+ members",
                  "Custom branding",
                  "Advanced reporting",
                  "Custom onboarding",
                  "Dedicated success manager",
                  "SSO (roadmap)",
                  "API access (roadmap)",
                  "White-label (roadmap)",
                ],
                cta: "Contact sales",
                href: "#contact",
                featured: false,
              },
            ].map((p) => {
              const cycle = p[billing];
              return (
                <div
                  key={p.name}
                  className={`relative flex flex-col rounded-2xl border p-6 shadow-card sm:p-8 ${
                    p.featured ? "border-primary bg-card ring-1 ring-primary" : "border-border bg-card"
                  }`}
                >
                  {p.featured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      Most popular
                    </span>
                  )}
                  <h3 className="font-serif text-xl font-semibold text-foreground">{p.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-serif text-3xl font-semibold text-foreground">{cycle.price}</span>
                    {cycle.period && <span className="text-sm text-muted-foreground">{cycle.period}</span>}
                  </div>
                  <p className="mt-1 min-h-[1.25rem] text-xs text-muted-foreground">{cycle.sub ?? "\u00A0"}</p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.blurb}</p>
                  <ul className="mt-6 space-y-2.5">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                        <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-gold" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8 pt-2">
                    <a
                      href={p.href}
                      className={`inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-medium transition ${
                        p.featured
                          ? "bg-primary text-primary-foreground shadow-elegant hover:bg-primary/90"
                          : "border border-border bg-background text-foreground hover:bg-accent"
                      }`}
                    >
                      {p.cta}
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-card">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              Contact us
            </span>
            <h2 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Talk to the team behind LexGuild
            </h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              LexGuild was designed and built by Bizooma Creative Agency. For questions about the platform, partnerships, or building something similar for your organization, get in touch with Joe directly.
            </p>
            <div className="mt-8 flex items-center gap-5 rounded-2xl border border-border bg-card p-5 shadow-card">
              <img
                src={bizoomaLogo}
                alt="Bizooma Creative Agency"
                className="h-16 w-auto shrink-0"
                loading="lazy"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Bizooma Creative Agency</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  <a href="mailto:joe@bizooma.com" className="hover:text-primary">joe@bizooma.com</a>
                </p>
              </div>
            </div>
          </div>

          <form
            className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8"
            onSubmit={async (e) => {
              e.preventDefault();
              if (submitting) return;
              const form = e.currentTarget;
              const data = new FormData(form);
              const payload = {
                name: String(data.get("name") || "").trim(),
                email: String(data.get("email") || "").trim(),
                message: `${data.get("org") ? `Organization: ${data.get("org")}\n\n` : ""}${data.get("message") || ""}`.trim(),
              };
              setSubmitting(true);
              setContactStatus(null);
              try {
                const res = await fetch("/api/public/contact", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error("Send failed");
                setContactStatus("success");
                form.reset();
              } catch {
                setContactStatus("error");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="text-sm font-medium text-foreground">Name</label>
                <input
                  id="name"
                  name="name"
                  required
                  maxLength={100}
                  className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="org" className="text-sm font-medium text-foreground">Organization</label>
                <input
                  id="org"
                  name="org"
                  maxLength={150}
                  className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
            <div className="mt-4">
              <label htmlFor="email" className="text-sm font-medium text-foreground">Work email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                maxLength={255}
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="mt-4">
              <label htmlFor="message" className="text-sm font-medium text-foreground">How can we help?</label>
              <textarea
                id="message"
                name="message"
                rows={4}
                required
                maxLength={2000}
                className="mt-1.5 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-elegant transition hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Send message"}
            </button>
            {contactStatus === "success" && (
              <p className="mt-4 text-sm text-foreground">Thanks — your message is on its way. We'll be in touch shortly.</p>
            )}
            {contactStatus === "error" && (
              <p className="mt-4 text-sm text-destructive">Something went wrong. Please try again or email joe@bizooma.com directly.</p>
            )}
          </form>
        </div>
      </section>

      {/* Map */}
      <section aria-label="Our location" className="border-t border-border">
        <iframe
          title="LexGuild office location"
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3443.794538479383!2d-81.6591862!3d30.3283615!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x88e5b7ba8c79c7b7%3A0x29d0d337ce7701c4!2sBizooma%20Digital%20Marketing%20Agency!5e0!3m2!1sen!2sus!4v1778348328409!5m2!1sen!2sus"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          className="block h-[400px] w-full border-0 sm:h-[450px]"
        />
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-xs text-muted-foreground sm:flex-row">
          <p>© 2026 LexGuild.com | The Professional Mentorship Platform for Modern Legal Organizations</p>
          
        </div>
      </footer>
    </div>
  );
}
