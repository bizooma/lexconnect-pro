/**
 * Single source of truth for plan entitlement in the UI/server-fn layer.
 *
 * Principle: an ACTIVE TRIAL gets full top-tier access. Paid organizations
 * stay tier-gated. This mirrors the SQL functions `has_white_label(_org)` and
 * `ai_monthly_limit(_org)` — never hardcode plan/role shortcuts elsewhere.
 */

export type PlanId = "starter" | "pro" | "firm";

export type EntitlementInput = {
  plan?: string | null;
  status?: string | null;
  trial_end?: string | null;
} | null | undefined;

export function normalizePlan(plan?: string | null): PlanId {
  return plan === "pro" ? "pro" : plan === "firm" ? "firm" : "starter";
}

/** True while a trial is running (no end date = open-ended trial). */
export function isTrialActive(sub: EntitlementInput): boolean {
  if (!sub || sub.status !== "trialing") return false;
  return !sub.trial_end || new Date(sub.trial_end) > new Date();
}

/** Subscription is in good standing (paid, grandfathered, or active trial). */
export function isSubscriptionCurrent(sub: EntitlementInput): boolean {
  const status = sub?.status ?? null;
  return status === "active" || status === "grandfathered" || isTrialActive(sub);
}

/** Top-tier features (white-label, custom domains, portal branding). */
export function hasTopTierAccess(sub: EntitlementInput): boolean {
  if (isTrialActive(sub)) return true;
  return (
    normalizePlan(sub?.plan) === "firm" &&
    (sub?.status === "active" || sub?.status === "grandfathered")
  );
}

export const PLAN_AI_LIMITS: Record<PlanId, number> = {
  starter: 20,
  pro: 100,
  firm: 300,
};

/** Monthly AI allowance: active trials evaluate at the top-tier limit. */
export function aiMonthlyLimit(sub: EntitlementInput): number {
  if (isTrialActive(sub)) return PLAN_AI_LIMITS.firm;
  return PLAN_AI_LIMITS[normalizePlan(sub?.plan)];
}
