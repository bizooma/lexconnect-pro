import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/logo";

type Search = { session_id?: string };

export const Route = createFileRoute("/checkout/return")({
  head: () => ({
    meta: [
      { title: "Subscription confirmed — LexGuild" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): Search => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Logo />
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-16 text-center">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mt-4 font-serif text-3xl font-semibold text-foreground">You're all set</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your subscription is active. We're processing the confirmation in the background — your billing page will reflect the new plan in a moment.
        </p>
        {session_id && (
          <p className="mt-3 text-[11px] text-muted-foreground/70">Session: <span className="font-mono">{session_id.slice(0, 24)}…</span></p>
        )}
        <div className="mt-8 flex justify-center gap-3">
          <Link
            to="/app/dashboard"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to dashboard
          </Link>
          <Link
            to="/app/org/billing"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            View billing
          </Link>
        </div>
      </main>
    </div>
  );
}
