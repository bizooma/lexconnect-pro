import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { getAiQuota } from "@/lib/website-ai.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Quota = {
  used: number;
  limit: number;
  remaining: number;
  purchased: number;
  period: string;
  resetsOn: string;
};

export function AiUsageCard() {
  const { currentOrgId } = useCurrentOrg();
  const quotaFn = useServerFn(getAiQuota);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!currentOrgId) return;
    quotaFn({ data: { organizationId: currentOrgId } })
      .then((r) =>
        setQuota({
          used: r.used,
          limit: r.limit,
          remaining: r.remaining,
          purchased: r.purchased,
          period: r.period,
          resetsOn: r.resetsOn,
        }),
      )
      .catch(() => {});
  }, [currentOrgId, quotaFn]);

  if (!quota) return null;

  const pct = quota.limit > 0 ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">AI usage</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Each AI page draft, template fill, section rewrite, or site-builder page uses one generation.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Buy more credits
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buy more AI generations</DialogTitle>
              <DialogDescription className="space-y-3 pt-2">
                <p>
                  Need more generations? Contact us to add credits to your account — one-click purchase is coming soon.
                </p>
                <p>
                  <a
                    href="mailto:sales@lexguild.com?subject=AI%20generation%20credits%20request"
                    className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                  >
                    Contact sales
                  </a>
                </p>
                {/* TODO: attach Stripe one-time checkout here for org-level AI credit packs */}
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">AI generations this month</span>
          <span className="font-medium text-foreground">
            {quota.used} of {quota.limit} used
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        {quota.purchased > 0 && (
          <p className="text-sm text-muted-foreground">
            Purchased credits: <span className="font-medium text-foreground">{quota.purchased}</span>
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Resets {quota.resetsOn ? new Date(quota.resetsOn).toLocaleDateString() : "at the end of the period"}
          {quota.period ? ` (${quota.period})` : ""}.
        </p>
      </div>
    </section>
  );
}
