import { createServerFn } from "@tanstack/react-start";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

type Input = { sessionId: string; environment: StripeEnv };

export type CheckoutStatusResult = {
  status: "complete" | "open" | "expired" | "unknown";
  paymentStatus: "paid" | "unpaid" | "no_payment_required" | "unknown";
};

export const getCheckoutStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown): Input => {
    const d = (data ?? {}) as Partial<Input>;
    if (!d.sessionId || typeof d.sessionId !== "string") throw new Error("sessionId required");
    return {
      sessionId: d.sessionId,
      environment: d.environment === "sandbox" ? "sandbox" : "live",
    };
  })
  .handler(async ({ data }): Promise<CheckoutStatusResult> => {
    const stripe = createStripeClient(data.environment);
    const session = await stripe.checkout.sessions.retrieve(data.sessionId);
    return {
      status: (session.status as CheckoutStatusResult["status"]) ?? "unknown",
      paymentStatus:
        (session.payment_status as CheckoutStatusResult["paymentStatus"]) ?? "unknown",
    };
  });
