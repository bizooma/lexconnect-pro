import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/logo";
import heroBg from "@/assets/hero-bg.jpg";
import phoneMockup from "@/assets/lex-phones.png";
import bizoomaLogo from "@/assets/bizooma-logo.png";
import installIosSafari from "@/assets/install-ios-safari.png";
import installIosChrome from "@/assets/install-ios-chrome.png";
import installAndroid from "@/assets/install-android.png";
import addonWebsiteBuilder from "@/assets/addon-website-builder.jpg";
import addonAttorneyDirectory from "@/assets/addon-attorney-directory.jpg";
import addonCleLms from "@/assets/addon-cle-lms.jpg";
import { resolveCurrentHost } from "@/lib/website-domains.functions";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    try {
      const { redirectTo } = await resolveCurrentHost();
      if (redirectTo) throw redirect({ to: redirectTo });
    } catch (e) {
      if (e && typeof e === "object" && "isRedirect" in e) throw e;
      // Swallow lookup failures — fall through to marketing site.
    }
  },
  head: () => ({
    meta: [
      { title: "LexGuild — Modern attorney mentorship" },
      { name: "description", content: "A modern, mobile-first mentorship platform for attorneys, bar associations, and legal organizations." },
      { property: "og:title", content: "LexGuild — Modern attorney mentorship" },
      { property: "og:description", content: "A modern, mobile-first mentorship platform for attorneys, bar associations, and legal organizations." },
      { property: "og:url", content: "https://lexguild.com/" },
      { property: "og:image", content: "https://lexguild.com/og-image.png" },
    ],
    links: [
      { rel: "canonical", href: "https://lexguild.com/" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [submitting, setSubmitting] = useState(false);
  const [contactStatus, setContactStatus] = useState<null | "success" | "error">(null);
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground sm:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#install" className="hover:text-foreground">Install</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <a href="#addons" className="hover:text-foreground">Add-ons</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
            <a href="#contact" className="hover:text-foreground">Contact</a>
            <Link to="/login" className="text-foreground hover:text-primary">Sign in</Link>
          </nav>
          <Link
            to="/login"
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-elegant transition-colors hover:bg-primary/90 sm:hidden"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <img
          src={heroBg}
          alt=""
          aria-hidden="true"
          width={1920}
          height={1080}
          fetchPriority="high"
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
            <p data-speakable className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
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
              width={900}
              height={900}
              fetchPriority="high"
              className="w-full h-auto"
            />
          </div>
        </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" aria-labelledby="features-heading" className="bg-gradient-navy">
        <h2 id="features-heading" className="sr-only">Features</h2>
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
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-card">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              Install LexGuild on your phone
            </span>
            <h2 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Why install LexGuild on your phone?
            </h2>
            <p className="mt-3 text-lg font-medium text-foreground">
              A faster, more connected mentorship experience.
            </p>
            <p className="mt-4 text-base text-muted-foreground">
              LexGuild was designed to work like a modern mobile app — giving attorneys quick access to mentorship conversations, meeting schedules, and professional connections without the friction of traditional email-based communication.
            </p>
          </div>

          <h3 className="mx-auto mt-12 max-w-4xl text-center font-serif text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
            Installed on your phone as a Progressive Web App (PWA), LexGuild delivers a faster, cleaner, and more seamless experience for busy legal professionals.
          </h3>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { src: installIosSafari, alt: "Install LexGuild on iPhone using Safari — step-by-step screenshots" },
              { src: installIosChrome, alt: "Install LexGuild on iPhone using Chrome — step-by-step screenshots" },
              { src: installAndroid, alt: "Install LexGuild on Android using Chrome — step-by-step screenshots" },
            ].map((img) => (
              <div key={img.alt} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                <img src={img.src} alt={img.alt} loading="lazy" className="h-auto w-full" />
              </div>
            ))}
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <h3 className="font-serif text-xl font-semibold text-foreground">Instant access to your legal community</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                Once installed, LexGuild appears directly on your home screen like a native mobile app. No searching through browser tabs or email threads — simply tap the LexGuild icon to instantly access your mentorship network.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <h3 className="font-serif text-xl font-semibold text-foreground">Real-time notifications without inbox overload</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                Traditional mentorship programs rely heavily on email, which gets buried beneath hundreds of daily messages. With LexGuild on your device, push notifications come straight to you:
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                <li>• Mentorship requests</li>
                <li>• New messages</li>
                <li>• Meeting reminders</li>
                <li>• Organization announcements</li>
                <li>• Professional development updates</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <h3 className="font-serif text-xl font-semibold text-foreground">Designed for busy attorneys</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                Legal professionals are constantly moving between courtrooms, meetings, client calls, networking events, and conferences. LexGuild's mobile-first experience keeps mentors and mentees connected from anywhere with:
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                <li>• Real-time messaging</li>
                <li>• Voice notes</li>
                <li>• Mentorship scheduling</li>
                <li>• Quick profile access</li>
                <li>• Meeting reminders</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <h3 className="font-serif text-xl font-semibold text-foreground">App-like experience without the App Store</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                LexGuild uses modern Progressive Web App technology, so members install the platform directly from their browser — no App Store or Google Play download required.
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                <li>• Faster updates</li>
                <li>• No manual app downloads</li>
                <li>• Less storage usage</li>
                <li>• Improved performance</li>
                <li>• Secure access across devices</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-card md:col-span-2">
              <h3 className="font-serif text-xl font-semibold text-foreground">Stay connected to mentorship opportunities</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                Whether you're mentoring younger attorneys, growing your professional network, participating in a bar association program, or managing organizational mentorship initiatives — LexGuild keeps mentorship active, accessible, and engaging throughout your day.
              </p>
            </div>
          </div>

          <div className="mx-auto mt-12 max-w-3xl text-center">
            <h3 className="font-serif text-2xl font-semibold tracking-tight text-foreground">Built for the modern legal profession</h3>
            <p className="mt-3 text-base text-muted-foreground">
              LexGuild modernizes attorney mentorship by replacing fragmented communication and outdated listservs with a clean, professional, mobile-first experience designed specifically for legal organizations and their members.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border bg-gradient-slate">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80 shadow-card">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              Pricing
            </span>
            <h2 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Plans that grow with your organization
            </h2>
            <p className="mt-3 text-base text-white/75">
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
                href: `/signup?plan=starter&billing=${billing}`,
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
                href: `/signup?plan=professional&billing=${billing}`,
                featured: true,
              },
              {
                name: "Enterprise",
                monthly: { price: "Custom", period: "", sub: "From $1,500/mo" },
                annual: { price: "Custom", period: "", sub: "From $1,500/mo" },
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
                  className={`relative flex flex-col rounded-2xl border p-6 shadow-card backdrop-blur-xl sm:p-8 ${
                    p.featured
                      ? "border-white/30 bg-white/20 ring-1 ring-white/40"
                      : "border-white/20 bg-white/10"
                  }`}
                >
                  {p.featured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      Most popular
                    </span>
                  )}
                  <h3 className="font-serif text-xl font-semibold text-white">{p.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-serif text-3xl font-semibold text-white">{cycle.price}</span>
                    {cycle.period && <span className="text-sm text-white/70">{cycle.period}</span>}
                  </div>
                  <p className="mt-1 min-h-[1.25rem] text-xs text-white/70">{cycle.sub ?? "\u00A0"}</p>
                  <p className="mt-3 text-sm leading-relaxed text-white/80">{p.blurb}</p>
                  <ul className="mt-6 space-y-2.5">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-white">
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
                          ? "bg-white text-foreground shadow-elegant hover:bg-white/90"
                          : "border border-white/30 bg-white/10 text-white hover:bg-white/20"
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

      {/* Platform Add-ons */}
      <section id="addons" className="border-t border-border bg-background">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-card">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              Expand your platform
            </span>
            <h2 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Platform Add-ons
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Supercharge your organization with powerful modules designed specifically for the legal profession.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {[
              {
                img: addonWebsiteBuilder,
                alt: "Website Builder — drag-and-drop editor for legal organizations",
                badge: "Coming soon",
                title: "Website Builder",
                desc: "Create a beautiful, professional website for your bar association or legal organization with our drag-and-drop editor. No coding required.",
                features: ["Drag-and-drop page editor", "Custom domains & SSL", "Lead capture forms", "Organization branding"],
              },
              {
                img: addonAttorneyDirectory,
                alt: "Attorney Directory — searchable lawyer referral service",
                badge: "Coming soon",
                title: "Attorney Directory & Referral Service",
                desc: "A searchable directory of vetted attorneys that evolves into a full lawyer referral service for your members and the public.",
                features: ["Searchable attorney profiles", "Practice area filters", "Referral tracking", "Public & member access"],
              },
              {
                img: addonCleLms,
                alt: "CLE Learning Management System — continuing legal education courses",
                badge: "Coming soon",
                title: "CLE & Learning Management",
                desc: "Deliver Continuing Legal Education courses, certification tracks, and professional development through an integrated learning platform.",
                features: ["Course creation & hosting", "Progress tracking", "Certificates & credits", "Member enrollment"],
              },
            ].map((card) => (
              <div
                key={card.title}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition hover:shadow-elegant"
              >
                <div className="relative aspect-[3/2] overflow-hidden">
                  <img
                    src={card.img}
                    alt={card.alt}
                    loading="lazy"
                    width={1200}
                    height={800}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  <span className={`absolute top-3 right-3 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    card.badge === "Available now"
                      ? "bg-gold text-gold-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {card.badge}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-serif text-xl font-semibold text-foreground">{card.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{card.desc}</p>
                  <ul className="mt-4 space-y-1.5">
                    {card.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-gold" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FAQSection />

      {/* Contact */}
      <section id="contact" className="border-t border-border bg-gradient-navy">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-card">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              Contact us
            </span>
            <h2 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Talk to the team behind LexGuild
            </h2>
            <p className="mt-3 text-base leading-relaxed text-white/80">
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
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-xs text-muted-foreground sm:flex-row">
          <p>© 2026 LexGuild.com | The Professional Mentorship Platform for Modern Legal Organizations</p>
          <nav className="flex items-center gap-5">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <a href="#contact" className="hover:text-foreground">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is LexGuild?",
    a: "LexGuild is an invitation-only mentorship and member engagement platform built for the legal profession. Bar associations, law firms, and legal organizations use it to run structured attorney mentorship programs with curated matching, secure messaging, voice notes, and lightweight scheduling.",
  },
  {
    q: "Who is LexGuild for?",
    a: "LexGuild is designed for state and local bar associations, law firms, in-house legal departments, law schools, and affinity bar groups that want to formalize attorney-to-attorney mentorship and professional development at scale.",
  },
  {
    q: "How does attorney mentorship work on LexGuild?",
    a: "Administrators invite members, who complete a short profile covering practice area, jurisdiction, and career stage. LexGuild suggests curated mentor and mentee matches, then participants connect through in-app messaging, voice notes, and scheduled meetings — all in one secure environment.",
  },
  {
    q: "How much does LexGuild cost?",
    a: "LexGuild offers three tiers: Starter at $399 per month for up to 25 members, Professional at $899 per month for up to 100 members, and Enterprise with custom pricing starting at $1,500 per month for 250+ members. Annual plans include roughly two months free.",
  },
  {
    q: "Is LexGuild secure and confidential?",
    a: "Yes. Member data and conversations are protected with role-based access controls, encrypted transport, and granular admin permissions, so confidential mentorship discussions stay private to the participants and your organization.",
  },
  {
    q: "Can I use LexGuild on my phone?",
    a: "Yes. LexGuild is a mobile-first progressive web app, so members can install it on iPhone or Android directly from the browser and get a native-feeling experience without an app store download.",
  },
  {
    q: "How long does it take to launch a LexGuild organization?",
    a: "Most organizations are up and running in under a week. You can create your organization, customize branding, import or invite members, and start matching mentors and mentees the same day you sign up.",
  },
  {
    q: "Does LexGuild replace our existing bar association software?",
    a: "LexGuild is purpose-built for mentorship and member engagement, not membership billing or CLE tracking. It complements existing AMS or LMS tools by giving your members a modern, easy-to-use space to build relationships and grow their careers.",
  },
];

function FAQSection() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <section id="faq" className="border-t border-border bg-background">
      <div className="mx-auto max-w-4xl px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-card">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            Frequently asked questions
          </span>
          <h2 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Answers about LexGuild
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            Everything bar associations, law firms, and legal organizations ask before launching a mentorship program with LexGuild.
          </p>
        </div>

        <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card shadow-card">
          {FAQS.map((f) => (
            <details key={f.q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-left">
                <h3 className="font-serif text-lg font-semibold text-foreground">{f.q}</h3>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition group-open:rotate-45 group-open:bg-primary group-open:text-primary-foreground">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </section>
  );
}
