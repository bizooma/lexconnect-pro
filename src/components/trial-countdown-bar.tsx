import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { usePortalTheme } from "@/components/portal-theme-provider";
import { isTrialActive } from "@/lib/entitlements";

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days >= 1) {
    return `${days} day${days === 1 ? "" : "s"}, ${hours} hour${hours === 1 ? "" : "s"} left in your free trial`;
  }
  if (hours >= 1) {
    return `${hours} hour${hours === 1 ? "" : "s"}, ${minutes} minute${minutes === 1 ? "" : "s"} left in your free trial`;
  }
  return `${minutes} minute${minutes === 1 ? "" : "s"}, ${seconds} second${seconds === 1 ? "" : "s"} left in your free trial`;
}

/**
 * Display-only trial countdown. Access enforcement stays server-side
 * (org_can_write / Postgres now()); this never gates anything.
 */
export function TrialCountdownBar() {
  const { subscription, isOrgAdmin } = useCurrentOrg();
  const { portal } = usePortalTheme();
  const trialEnd = subscription?.trial_end ?? null;
  const active = isOrgAdmin && !portal && isTrialActive(subscription) && !!trialEnd;

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active || !trialEnd) return;
    const end = new Date(trialEnd).getTime();
    const tick = () => setNow(Date.now());
    tick();
    const remaining = end - Date.now();
    const interval = remaining < 60 * 60 * 1000 ? 1000 : 60 * 1000;
    const id = window.setInterval(tick, interval);
    return () => window.clearInterval(id);
  }, [active, trialEnd, Math.floor((new Date(trialEnd ?? 0).getTime() - now) / (60 * 60 * 1000))]);

  if (!active || !trialEnd) return null;

  const end = new Date(trialEnd);
  const remaining = end.getTime() - now;
  if (remaining <= 0) return null;

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 bg-red-600 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-xs">
          <span className="font-medium">
            {formatRemaining(remaining)}
            <span className="ml-2 hidden font-normal text-white/75 sm:inline">
              Ends {end.toLocaleString()}
            </span>
          </span>
          <Link
            to="/app/org/billing"
            className="rounded-md bg-white/15 px-3 py-1 font-semibold text-white transition hover:bg-white/25"
          >
            Upgrade now
          </Link>
        </div>
      </div>
      <div className="h-8" aria-hidden />
    </>
  );
}
