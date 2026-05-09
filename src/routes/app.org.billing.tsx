import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { Button } from "@/components/ui/button";
import { createPortalSession } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { toast } from "sonner";

export const Route = createFileRoute("/app/org/billing")({
  component: OrgBillingPage,
});

const PLAN_OPTIONS = [
  { id: "starter_monthly", label: "Starter — $399/mo", tier: "starter" },
  { id: "starter_annual", label: "Starter — $3,990/yr (save 2 months)", tier: "starter" },
  { id: "professional_monthly", label: "Professional — $899/mo", tier: "professional" },
  { id: "professional_annual", label: "Professional — $8,990/yr (save 2 months)", tier: "professional" },
] as const;

function OrgBillingPage() {
  const { currentOrgId, currentOrg, subscription, isOrgAdmin } = useCurrentOrg();
  const [seatsUsed, setSeatsUsed] = useState(0);
  const [openingPortal, setOpeningPortal] = useState(false);
  const portal = useServerFn(createPortalSession);

  useEffect(() => {
    if (!currentOrgId) return;
    supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", currentOrgId)
      .in("status", ["active", "invited"])
      .then(({ count }) => setSeatsUsed(count ?? 0));
  }, [currentOrgId]);

  if (!currentOrgId) {
    return <div className="p-8 text-sm text-muted-foreground">No organization selected.</div>;
  }

  const status = subscription?.status ?? "incomplete";
  const seatsCap = subscription?.seats_purchased ?? 0;
  const usagePct = seatsCap > 0 ? Math.min(100, Math.round((seatsUsed / seatsCap) * 100)) : 0;
  const warning = seatsCap > 0 && seatsUsed / seatsCap >= 0.8;
  const isGrandfathered = status === "grandfathered";
  const hasPaidSubscription = !!subscription?.stripe_subscription_id;

  const statusTone =
    status === "active" || status === "grandfathered" || status === "trialing"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : "bg-destructive/10 text-destructive";

  const openPortal = async () => {
    if (!currentOrgId) return;
    setOpeningPortal(true);
    try {
      const url = await portal({
        data: {
          organizationId: currentOrgId,
          returnUrl: `${window.location.origin}/app/org/billing`,
          environment: getStripeEnvironment(),
        },
      });
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open billing portal");
    } finally {
      setOpeningPortal(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Organization</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-foreground">Billing & seats</h1>
        <p className="mt-1 text-sm text-muted-foreground">{currentOrg?.name}</p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Current plan</p>
            <p className="mt-1 font-serif text-2xl font-semibold capitalize text-foreground">
              {subscription?.plan ?? "—"}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusTone}`}>
            {status.replace("_", " ")}
          </span>
        </div>

        <div className="mt-6">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Seats used</span>
            <span className="font-medium text-foreground">
              {seatsUsed} of {seatsCap || "∞"}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full ${warning ? "bg-destructive" : "bg-primary"}`}
              style={{ width: `${seatsCap > 0 ? usagePct : 0}%` }}
            />
          </div>
          {warning && (
            <p className="mt-2 text-xs text-destructive">
              You're nearing your seat limit. Upgrade your plan or remove a member to keep inviting.
            </p>
          )}
        </div>

        {subscription?.current_period_end && (
          <p className="mt-4 text-xs text-muted-foreground">
            Renews {new Date(subscription.current_period_end).toLocaleDateString()}
          </p>
        )}
      </section>

      {isOrgAdmin && isGrandfathered && (
        <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <h2 className="font-serif text-lg font-semibold text-foreground">Complimentary access</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <strong>{currentOrg?.name}</strong> has permanent free access to LexGuild — no billing required.
          </p>
        </section>
      )}

      {isOrgAdmin && !isGrandfathered && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="font-serif text-lg font-semibold text-foreground">
            {hasPaidSubscription ? "Manage your subscription" : "Choose a plan"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasPaidSubscription
              ? "Update your payment method, change plan, or cancel anytime via the secure billing portal."
              : "Pick a plan to activate full access for your organization."}
          </p>

          {!hasPaidSubscription && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {PLAN_OPTIONS.map((opt) => (
                <Link
                  key={opt.id}
                  to="/checkout"
                  search={{ price: opt.id }}
                  className="rounded-xl border border-border bg-background p-4 text-left text-sm hover:border-primary hover:bg-accent"
                >
                  <p className="font-medium text-foreground">{opt.label}</p>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {hasPaidSubscription && (
              <Button onClick={openPortal} disabled={openingPortal}>
                {openingPortal ? "Opening…" : "Manage billing"}
              </Button>
            )}
            <Link
              to="/"
              hash="contact"
              className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-accent"
            >
              Contact sales (Enterprise)
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
