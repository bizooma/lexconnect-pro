import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — LexGuild" },
      { name: "description", content: "The terms that govern use of LexGuild's mentorship platform for legal organizations." },
      { property: "og:title", content: "Terms of Service — LexGuild" },
      { property: "og:description", content: "The terms that govern use of LexGuild's mentorship platform." },
      { property: "og:url", content: "https://lexguild.com/terms" },
    ],
    links: [
      { rel: "canonical", href: "https://lexguild.com/terms" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5">
          <Link to="/"><Logo /></Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="font-serif text-4xl font-semibold text-foreground">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: May 9, 2026</p>

        <div className="mt-8 space-y-6 text-sm text-muted-foreground">
          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">1. Acceptance</h2>
            <p>By accessing or using LexGuild, you agree to these Terms of Service. If you are using LexGuild on behalf of an organization, you represent that you have authority to bind that organization.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">2. The Service</h2>
            <p>LexGuild provides a hosted mentorship and member engagement platform for attorneys and legal organizations, including messaging, mentorship matching, scheduling, and reporting features.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">3. Accounts</h2>
            <p>You must provide accurate information and keep your credentials secure. You are responsible for activity under your account. Organization administrators may invite, manage, and remove members from their organization.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">4. Acceptable Use</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>No unlawful, harassing, or deceptive content.</li>
              <li>No sharing of privileged client information that you are not authorized to share.</li>
              <li>No reverse engineering, scraping, or interfering with the service.</li>
              <li>No use of LexGuild to provide legal advice to non-clients in violation of professional rules.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">5. Subscriptions and Payment</h2>
            <p>Plans are billed monthly or annually to the organization. Fees are non-refundable except as required by law. We may change pricing on renewal with reasonable notice.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">6. Customer Data</h2>
            <p>Your organization owns the content it submits. You grant LexGuild a limited license to host, process, and display that content solely to operate the service. We process personal information as described in our <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">7. Confidentiality and Professional Responsibility</h2>
            <p>LexGuild is a tool used by legal professionals. You are responsible for complying with all applicable rules of professional conduct, including those concerning client confidentiality, conflicts, and the unauthorized practice of law.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">8. Termination</h2>
            <p>You may cancel at any time. We may suspend or terminate accounts that violate these terms. Upon termination, your access ends and we will delete or return data per our retention policy.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">9. Disclaimers</h2>
            <p>THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. LEXGUILD DOES NOT PROVIDE LEGAL ADVICE, AND CONTENT EXCHANGED ON THE PLATFORM IS NOT LEGAL ADVICE FROM LEXGUILD.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">10. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, LexGuild's total liability for any claim arising from the service is limited to the amount paid by your organization in the prior 12 months.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">11. Changes</h2>
            <p>We may update these terms. Material changes will be communicated via the platform or by email.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">12. Contact</h2>
            <p>Questions about these terms? Email <a href="mailto:joe@bizooma.com" className="text-primary underline">joe@bizooma.com</a>.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
