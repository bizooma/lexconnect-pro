import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type Stripe from "stripe";

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const envParam = url.searchParams.get("env");
        if (envParam !== "sandbox" && envParam !== "live") {
          return new Response("Invalid env", { status: 400 });
        }
        const environment: StripeEnv = envParam;

        const secret =
          environment === "sandbox"
            ? process.env.PAYMENTS_SANDBOX_WEBHOOK_SECRET
            : process.env.PAYMENTS_LIVE_WEBHOOK_SECRET;
        if (!secret) {
          console.error("[payments/webhook] missing webhook secret for", environment);
          return new Response("Misconfigured", { status: 500 });
        }

        const sig = request.headers.get("stripe-signature");
        if (!sig) return new Response("Missing signature", { status: 400 });

        const body = await request.text();
        const stripe = createStripeClient(environment);

        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(body, sig, secret);
        } catch (err) {
          console.error("[payments/webhook] signature verification failed", err);
          return new Response("Invalid signature", { status: 400 });
        }

        try {
          await handleEvent(event, environment, stripe);
        } catch (err) {
          console.error("[payments/webhook] handler error", event.type, err);
          return new Response("Handler error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});

const PRICE_TO_PLAN: Record<string, { plan: "starter" | "pro" | "firm"; seats: number }> = {
  starter_monthly: { plan: "starter", seats: 25 },
  starter_annual: { plan: "starter", seats: 25 },
  professional_monthly: { plan: "pro", seats: 100 },
  professional_annual: { plan: "pro", seats: 100 },
};

type SubStatus = "active" | "canceled" | "grandfathered" | "incomplete" | "past_due" | "trialing";

function statusFromStripe(s: Stripe.Subscription.Status): SubStatus {
  switch (s) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
    case "paused":
    default:
      return "incomplete";
  }
}

async function handleEvent(event: Stripe.Event, environment: StripeEnv, stripe: ReturnType<typeof createStripeClient>) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription" || !session.subscription) return;
      const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      const sub = await stripe.subscriptions.retrieve(subId);
      await upsertSubscription(sub, environment);
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await upsertSubscription(sub, environment);
      return;
    }
    default:
      return;
  }
}

async function upsertSubscription(sub: Stripe.Subscription, environment: StripeEnv) {
  const orgId = sub.metadata?.organization_id;
  if (!orgId) {
    console.warn("[payments/webhook] subscription missing organization_id metadata", sub.id);
    return;
  }

  // Pull lookup_key from price (so we can map to a plan tier).
  const item = sub.items.data[0];
  const lookupKey = item?.price?.lookup_key ?? sub.metadata?.price_lookup_key ?? null;
  const mapped = lookupKey ? PRICE_TO_PLAN[lookupKey] : undefined;

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null;

  const status = statusFromStripe(sub.status);

  // Don't downgrade grandfathered orgs
  const { data: current } = await supabaseAdmin
    .from("subscriptions")
    .select("status")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (current?.status === "grandfathered") {
    console.log("[payments/webhook] skipping update for grandfathered org", orgId);
    return;
  }

  const update = {
    organization_id: orgId,
    status,
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId,
    current_period_end: periodEnd,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    environment,
    price_id: lookupKey,
    ...(mapped && { plan: mapped.plan, seats_purchased: mapped.seats, max_users: mapped.seats }),
    updated_at: new Date().toISOString(),
  };

  if (current) {
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update(update)
      .eq("organization_id", orgId);
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .insert(update);
    if (error) throw error;
  }
}
