import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/logo";

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
      <section className="mx-auto max-w-6xl px-5 pt-8 pb-16 sm:pt-16 sm:pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-card">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              An invitation-only network for the legal profession
            </span>
            <h1 className="mt-5 font-serif text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-[3.75rem]">
              The modern professional network<br />
              <span className="text-primary">for attorneys.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              LexGuild is where legal professionals connect, learn, and grow — pairing mentors with mentees, organizing bar association communities, and powering the next generation of attorney collaboration.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/onboarding"
                className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-elegant transition hover:bg-primary/90"
              >
                Request access
              </Link>
              <Link
                to="/app/dashboard"
                className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition hover:bg-accent"
              >
                Tour the platform
              </Link>
            </div>
            <div className="mt-10 flex items-center gap-6 text-xs text-muted-foreground">
              <span>Trusted by bar associations</span>
              <span className="h-3 w-px bg-border" />
              <span>SOC-2 ready</span>
              <span className="h-3 w-px bg-border" />
              <span>Mobile-first</span>
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

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-xs text-muted-foreground sm:flex-row">
          <p>© BridgeTRUST Mentorship. A platform for the modern bar.</p>
          <p>Demo content — not legal advice.</p>
        </div>
      </footer>
    </div>
  );
}
