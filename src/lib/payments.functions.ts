import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

const PRICE_ID_RE = /^[a-zA-Z0-9_-]+$/;

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    priceId: string;
    organizationId: string;
    returnUrl: string;
    environment: StripeEnv;
  }) => {
    if (!PRICE_ID_RE.test(data.priceId)) throw new Error("Invalid priceId");
    if (!data.organizationId) throw new Error("organizationId required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;

    // Verify caller is an admin/owner of the org
    const { data: membership, error: mErr } = await supabase
      .from("organization_members")
      .select("org_role, organizations(name)")
      .eq("organization_id", data.organizationId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (mErr || !membership) throw new Error("Not a member of this organization");
    if (membership.org_role !== "owner" && membership.org_role !== "admin") {
      throw new Error("Only org admins can manage billing");
    }

    // Look up the existing subscription row to reuse stripe_customer_id if any
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("organization_id", data.organizationId)
      .maybeSingle();

    const stripe = createStripeClient(data.environment);

    // Resolve human-readable priceId via lookup_keys
    const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
    if (!prices.data.length) throw new Error("Price not found");
    const stripePrice = prices.data[0];

    // Resolve / create customer keyed on organization_id
    let customerId = existing?.stripe_customer_id ?? undefined;
    if (!customerId) {
      const found = await stripe.customers.search({
        query: `metadata['organization_id']:'${data.organizationId}'`,
        limit: 1,
      });
      if (found.data.length) {
        customerId = found.data[0].id;
      } else {
        const userEmail = (claims.email as string | undefined) ?? undefined;
        const created = await stripe.customers.create({
          ...(userEmail && { email: userEmail }),
          metadata: {
            organization_id: data.organizationId,
            owner_user_id: userId,
          },
          name: (membership.organizations as { name?: string } | null)?.name,
        });
        customerId = created.id;
      }
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: "subscription",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      customer: customerId,
      metadata: {
        organization_id: data.organizationId,
        price_lookup_key: data.priceId,
      },
      subscription_data: {
        metadata: {
          organization_id: data.organizationId,
          price_lookup_key: data.priceId,
        },
      },
    });

    if (!session.client_secret) {
      console.error("[checkout] Stripe session missing client_secret", {
        sessionId: session.id,
        uiMode: session.ui_mode,
        mode: session.mode,
        status: session.status,
        paymentStatus: session.payment_status,
        priceLookupKey: data.priceId,
        organizationId: data.organizationId,
        environment: data.environment,
      });
      throw new Error("Checkout session did not return a client secret");
    }
    return session.client_secret;
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; returnUrl: string; environment: StripeEnv }) => {
    if (!data.organizationId) throw new Error("organizationId required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: membership } = await supabase
      .from("organization_members")
      .select("org_role")
      .eq("organization_id", data.organizationId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!membership || (membership.org_role !== "owner" && membership.org_role !== "admin")) {
      throw new Error("Only org admins can manage billing");
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (!sub?.stripe_customer_id) throw new Error("No billing account yet — start a subscription first");

    const stripe = createStripeClient(data.environment);
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: data.returnUrl,
    });
    return { url: portal.url };
  });
