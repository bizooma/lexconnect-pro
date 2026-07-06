import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Logo } from "@/components/logo";
import { getStripeEnvironment } from "@/lib/stripe";
import { getCheckoutStatus, type CheckoutStatusResult } from "@/lib/checkout-status.functions";

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
  const fetchStatus = useServerFn(getCheckoutStatus);
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "result"; result: CheckoutStatusResult }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    if (!session_id) {
      setState({ kind: "error", message: "Missing session id" });
      return;
    }
    fetchStatus({ data: { sessionId: session_id, environment: getStripeEnvironment() } })
      .then((result) => setState({ kind: "result", result }))
      .catch((err: unknown) =>
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "Could not verify your session",
        }),
      );
  }, [session_id, fetchStatus]);

  const isPaid =
    state.kind === "result" &&
    state.result.status === "complete" &&
    (state.result.paymentStatus === "paid" ||
      state.result.paymentStatus === "no_payment_required");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Logo />
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-16 text-center">
        {state.kind === "loading" && (
          <p className="text-sm text-muted-foreground">Confirming your payment…</p>
        )}

        {state.kind === "error" && (
          <>
            <h1 className="font-serif text-3xl font-semibold text-foreground">
              We couldn't confirm your payment
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
            <div className="mt-8 flex justify-center gap-3">
              <Link
                to="/app/org/billing"
                className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
              >
                Back to billing
              </Link>
            </div>
          </>
        )}

        {state.kind === "result" && isPaid && (
          <>
            <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="mt-4 font-serif text-3xl font-semibold text-foreground">You're all set</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your subscription is active. Your billing page will reflect the new plan in a moment.
            </p>
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
          </>
        )}

        {state.kind === "result" && !isPaid && (
          <>
            <h1 className="font-serif text-3xl font-semibold text-foreground">
              Payment not completed
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your checkout was {state.result.status === "expired" ? "expired" : "cancelled"} and no
              charge was made. You can try again whenever you're ready.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Link
                to="/app/org/billing"
                className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Back to billing
              </Link>
              <Link
                to="/"
                hash="pricing"
                className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
              >
                See plans
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
