import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/logo";
import heroBg from "@/assets/hero-bg.jpg";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground sm:flex">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#program" className="hover:text-foreground">For bar associations</a>
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
        <div className="grid items-center gap-12 lg:grid-cols-2">
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
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-navy opacity-20 blur-2xl" />
            <div className="rounded-[2rem] border border-border bg-gradient-navy p-3 shadow-elegant">
              <div className="overflow-hidden rounded-[1.6rem] bg-background">
                <div className="bg-gradient-navy px-5 pt-6 pb-8 text-primary-foreground">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Today</p>
                  <h3 className="mt-1 font-serif text-2xl font-semibold">Welcome back, Christopher.</h3>
                  <p className="mt-1 text-sm text-white/70">2 active mentorships · 1 meeting tomorrow</p>
                </div>
                <div className="space-y-3 p-4">
                  {[
                    { n: "Eleanor Whitfield", p: "Estate Planning · 22 yrs", m: 96 },
                    { n: "Marcus Tan", p: "Business Litigation · 18 yrs", m: 91 },
                    { n: "Priya Raman", p: "Solo Practice · 9 yrs", m: 88 },
                  ].map((c) => (
                    <div key={c.n} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-navy font-serif text-sm font-semibold text-gold">
                        {c.n.split(" ").map(s=>s[0]).join("")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{c.n}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.p}</p>
                      </div>
                      <span className="rounded-full bg-gold/15 px-2 py-1 text-[10px] font-semibold text-gold-foreground/80">
                        {c.m}% match
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border bg-card/50">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { t: "Curated mentor matching", d: "Pair mentors and mentees by practice area, jurisdiction, and career stage — no random listserv assignments." },
            { t: "Voice notes built in", d: "Busy attorneys talk faster than they type. Send 30-second voice notes inside any conversation." },
            { t: "Lightweight scheduling", d: "Suggest times, attach Zoom or Meet links, and get gentle reminders the day before." },
            { t: "Guided conversations", d: "Optional prompts keep mentorships meaningful — even during the busiest filing weeks." },
            { t: "Community insights", d: "Bar associations see active mentorships, engagement, and most-active practice areas at a glance." },
            { t: "Built to scale", d: "Foundation for CLE, leadership groups, and practice-area communities as your network grows." },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-navy text-gold">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <h3 className="font-serif text-lg font-semibold text-foreground">{f.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
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
              Transparent annual pricing for bar associations, law firms, and legal organizations. No per-seat surprises.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {[
              {
                name: "Chapter",
                price: "$2,400",
                period: "/year",
                blurb: "For small bar sections and local chapters getting started with structured mentorship.",
                features: [
                  "Up to 100 members",
                  "Curated mentor matching",
                  "Voice notes & messaging",
                  "Basic engagement insights",
                  "Email & web push notifications",
                ],
                cta: "Start your organization",
                featured: false,
              },
              {
                name: "Association",
                price: "$7,200",
                period: "/year",
                blurb: "For state and metro bar associations running active mentorship programs at scale.",
                features: [
                  "Up to 1,000 members",
                  "Everything in Chapter",
                  "Practice-area communities",
                  "Admin matching controls",
                  "Advanced engagement insights",
                  "Priority support",
                ],
                cta: "Start your organization",
                featured: true,
              },
              {
                name: "Enterprise",
                price: "Custom",
                period: "",
                blurb: "For statewide bars, AmLaw firms, and multi-chapter organizations with custom needs.",
                features: [
                  "Unlimited members",
                  "Everything in Association",
                  "SSO & SAML",
                  "Custom branding",
                  "Dedicated success manager",
                  "Onboarding & training",
                ],
                cta: "Contact sales",
                featured: false,
              },
            ].map((p) => (
              <div
                key={p.name}
                className={`relative flex flex-col rounded-2xl border p-6 shadow-card sm:p-8 ${
                  p.featured
                    ? "border-primary bg-card ring-1 ring-primary"
                    : "border-border bg-card"
                }`}
              >
                {p.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Most popular
                  </span>
                )}
                <h3 className="font-serif text-xl font-semibold text-foreground">{p.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-serif text-3xl font-semibold text-foreground">{p.price}</span>
                  {p.period && <span className="text-sm text-muted-foreground">{p.period}</span>}
                </div>
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
                    href={p.name === "Enterprise" ? "#contact" : "/signup"}
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
            ))}
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
              Talk to the LexGuild team
            </h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Curious whether LexGuild is right for your bar association, firm, or legal organization? Tell us a little about your program and we'll be in touch within one business day.
            </p>
            <dl className="mt-8 space-y-4 text-sm">
              <div>
                <dt className="font-medium text-foreground">Email</dt>
                <dd className="mt-1 text-muted-foreground">
                  <a href="mailto:hello@lexguild.com" className="hover:text-primary">hello@lexguild.com</a>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Sales & partnerships</dt>
                <dd className="mt-1 text-muted-foreground">
                  <a href="mailto:sales@lexguild.com" className="hover:text-primary">sales@lexguild.com</a>
                </dd>
              </div>
            </dl>
          </div>

          <form
            className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const data = new FormData(form);
              const subject = encodeURIComponent(`LexGuild inquiry from ${data.get("name") || "website"}`);
              const body = encodeURIComponent(
                `Name: ${data.get("name") || ""}\nOrganization: ${data.get("org") || ""}\nEmail: ${data.get("email") || ""}\n\n${data.get("message") || ""}`,
              );
              window.location.href = `mailto:hello@lexguild.com?subject=${subject}&body=${body}`;
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="text-sm font-medium text-foreground">Name</label>
                <input
                  id="name"
                  name="name"
                  required
                  className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="org" className="text-sm font-medium text-foreground">Organization</label>
                <input
                  id="org"
                  name="org"
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
                className="mt-1.5 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <button
              type="submit"
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-elegant transition hover:bg-primary/90"
            >
              Send message
            </button>
          </form>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-xs text-muted-foreground sm:flex-row">
          <p>© LexGuild. The professional network for the legal community.</p>
          <p>Demo content — not legal advice.</p>
        </div>
      </footer>
    </div>
  );
}
