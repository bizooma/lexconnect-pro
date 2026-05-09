import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/org/billing")({
  component: OrgBillingPage,
});

function OrgBillingPage() {
  const { currentOrgId, currentOrg, subscription, isOrgAdmin } = useCurrentOrg();
  const [seatsUsed, setSeatsUsed] = useState(0);

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

  const statusTone =
    status === "active" || status === "grandfathered" || status === "trialing"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : "bg-destructive/10 text-destructive";

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
              You're nearing your seat limit. Add more seats to keep inviting members.
            </p>
          )}
        </div>

        {subscription?.current_period_end && (
          <p className="mt-4 text-xs text-muted-foreground">
            Renews {new Date(subscription.current_period_end).toLocaleDateString()}
          </p>
        )}
      </section>

      {isOrgAdmin && (
        <section className="mt-6 rounded-2xl border border-dashed border-border bg-card p-6">
          <h2 className="font-serif text-lg font-semibold text-foreground">Manage subscription</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Stripe billing isn't connected yet. Once enabled, you'll be able to choose a plan, change seat counts, and
            update your payment method here.
          </p>
          <div className="mt-4 flex gap-2">
            <Button disabled>Choose plan</Button>
            <Button variant="outline" disabled>Manage billing</Button>
          </div>
        </section>
      )}
    </div>
  );
}
