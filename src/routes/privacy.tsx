import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — LexGuild" },
      { name: "description", content: "How LexGuild collects, uses, and protects information for attorneys, bar associations, and legal organizations." },
      { property: "og:title", content: "Privacy Policy — LexGuild" },
      { property: "og:description", content: "How LexGuild collects, uses, and protects information." },
      { property: "og:url", content: "https://lexguild.com/privacy" },
    ],
    links: [
      { rel: "canonical", href: "https://lexguild.com/privacy" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5">
          <Link to="/"><Logo /></Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="font-serif text-4xl font-semibold text-foreground">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: May 9, 2026</p>

        <div className="prose prose-sm mt-8 max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">Introduction</h2>
            <p>LexGuild ("we," "us," "our") provides a mentorship and member engagement platform for attorneys, bar associations, law firms, and legal organizations. This Privacy Policy explains what information we collect, how we use it, and the rights you have.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">Information We Collect</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Account information:</strong> name, email, password (hashed), profile details, organization affiliation.</li>
              <li><strong>Mentorship content:</strong> messages, voice notes, meeting details, and matching preferences you submit.</li>
              <li><strong>Usage data:</strong> log data, device type, browser, IP address, and analytics events.</li>
              <li><strong>Cookies:</strong> session cookies necessary for authentication.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">How We Use Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To operate, maintain, and secure the platform.</li>
              <li>To match mentors and mentees and deliver core features.</li>
              <li>To send transactional emails (invitations, notifications, account changes).</li>
              <li>To provide aggregated analytics to organization administrators.</li>
              <li>To comply with legal obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">Sharing</h2>
            <p>We do not sell personal information. We share data with subprocessors that help us run the service (cloud hosting, email delivery, analytics) under appropriate confidentiality and security obligations. We may disclose information when required by law.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">Data Retention</h2>
            <p>We retain account and mentorship data for as long as your organization maintains an active subscription, and for a reasonable period thereafter to comply with legal and operational requirements. You may request deletion at any time.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">Your Rights</h2>
            <p>Depending on your jurisdiction, you may have rights to access, correct, export, or delete your personal information, and to object to or restrict certain processing. Contact us at <a href="mailto:joe@bizooma.com" className="text-primary underline">joe@bizooma.com</a> to exercise these rights.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">Security</h2>
            <p>We use industry-standard safeguards including encryption in transit, role-based access controls, and row-level security in our database. No system is 100% secure; please use a strong, unique password.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">Children</h2>
            <p>LexGuild is intended for legal professionals and is not directed to children under 16.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">Changes</h2>
            <p>We may update this policy from time to time. Material changes will be communicated through the platform or by email.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">Contact</h2>
            <p>Questions? Email <a href="mailto:joe@bizooma.com" className="text-primary underline">joe@bizooma.com</a>.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
