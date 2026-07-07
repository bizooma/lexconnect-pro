import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { CurrentOrgProvider, useCurrentOrg } from "@/hooks/use-current-org";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/lib/payments.functions";
import { Logo } from "@/components/logo";
import { PaymentTestModeBanner } from "@/components/payment-test-banner";

type Search = { price?: string };

const VALID_PRICES = new Set([
  "starter_monthly",
  "starter_annual",
  "professional_monthly",
  "professional_annual",
  "test_monthly",
]);

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [{ title: "Checkout — LexGuild" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  validateSearch: (search: Record<string, unknown>): Search => ({
    price: typeof search.price === "string" ? search.price : undefined,
  }),
  component: () => (
    <CurrentOrgProvider>
      <CheckoutPage />
    </CurrentOrgProvider>
  ),
});

function CheckoutPage() {
  const { price } = Route.useSearch();
  const { session, user, loading: authLoading } = useAuth();
  const {
    currentOrgId,
    currentOrg,
    loading: orgLoading,
    isOrgAdmin,
    subscription,
  } = useCurrentOrg();
  const navigate = useNavigate();
  const create = useServerFn(createCheckoutSession);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const validPrice = price && VALID_PRICES.has(price) ? price : null;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login" });
    }
  }, [authLoading, user, navigate]);

  const fetchClientSecret = useMemo(() => {
    if (!validPrice || !currentOrgId) return null;
    return async (): Promise<string> => {
      try {
        const result = await create({
          data: {
            accessToken: session?.access_token ?? "",
            priceId: validPrice,
            organizationId: currentOrgId,
            returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
            environment: getStripeEnvironment(),
          },
        });
        const checkoutFailure = extractCheckoutError(result);
        if (checkoutFailure) throw new Error(checkoutFailure);
        const clientSecret = extractClientSecret(result);
        if (!clientSecret) throw new Error("No client secret returned");
        return clientSecret;
      } catch (err) {
        let message = "Could not start checkout. Please try again.";
        if (err instanceof Response) {
          try {
            message = (await err.text()) || message;
          } catch {
            /* ignore */
          }
        } else if (err instanceof Error) {
          message = err.message;
        }
        setCheckoutError(message);
        throw new Error(message);
      }
    };
  }, [validPrice, currentOrgId, session?.access_token, create]);

  if (authLoading || orgLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!validPrice) {
    return (
      <Shell>
        <h1 className="font-serif text-2xl font-semibold text-foreground">Pick a plan</h1>
        <p className="mt-2 text-sm text-muted-foreground">No valid plan was selected.</p>
        <Link
          to="/"
          hash="pricing"
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          See pricing →
        </Link>
      </Shell>
    );
  }

  if (!currentOrgId) {
    return (
      <Shell>
        <h1 className="font-serif text-2xl font-semibold text-foreground">No organization</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You need to create an organization before subscribing.
        </p>
        <Link to="/onboarding" className="mt-4 inline-block text-sm text-primary hover:underline">
          Create one →
        </Link>
      </Shell>
    );
  }

  if (!isOrgAdmin) {
    return (
      <Shell>
        <h1 className="font-serif text-2xl font-semibold text-foreground">Admin access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only an owner or admin of <strong>{currentOrg?.name}</strong> can manage billing.
        </p>
      </Shell>
    );
  }

  if (subscription?.status === "grandfathered") {
    return (
      <Shell>
        <h1 className="font-serif text-2xl font-semibold text-foreground">All set</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          <strong>{currentOrg?.name}</strong> has complimentary access — no payment needed.
        </p>
        <Link
          to="/app/dashboard"
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          Go to dashboard →
        </Link>
      </Shell>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Logo />
          <Link
            to="/app/org/billing"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="font-serif text-2xl font-semibold text-foreground">
          Subscribe to {planLabel(validPrice)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Billing for <strong>{currentOrg?.name}</strong>
        </p>
        {checkoutError && (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {checkoutError}
          </div>
        )}
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {fetchClientSecret && !checkoutError && (
            <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          )}
        </div>
      </main>
    </div>
  );
}

function extractCheckoutError(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.error === "string" && !record.clientSecret && !record.client_secret) {
    return record.error;
  }
  return extractCheckoutError(record.result) ?? extractCheckoutError(record.data);
}

function extractClientSecret(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  return (
    extractClientSecret(record.clientSecret) ??
    extractClientSecret(record.client_secret) ??
    extractClientSecret(record.result) ??
    extractClientSecret(record.data)
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Logo />
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            Home
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-12">{children}</main>
    </div>
  );
}

function planLabel(price: string): string {
  const [tier, cadence] = price.split("_");
  const t = tier === "starter" ? "Starter" : tier === "professional" ? "Professional" : tier;
  const c = cadence === "annual" ? "annual" : "monthly";
  return `${t} (${c})`;
}
