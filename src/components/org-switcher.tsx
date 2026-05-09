import { useCurrentOrg } from "@/hooks/use-current-org";
import { Link } from "@tanstack/react-router";

export function OrgSwitcher() {
  const { memberships, currentOrgId, switchOrg, currentOrg, role, subscription } = useCurrentOrg();

  if (!currentOrg) {
    return (
      <Link to="/onboarding" className="block rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground hover:bg-accent">
        Create or join an organization
      </Link>
    );
  }

  const status = subscription?.status;
  const statusLabel =
    status === "past_due" ? "Past due" :
    status === "canceled" ? "Canceled" :
    status === "trialing" ? "Trial" :
    status === "grandfathered" ? "Active" :
    status === "active" ? "Active" : "Inactive";
  const statusTone = status === "past_due" || status === "canceled" || status === "incomplete"
    ? "bg-destructive/10 text-destructive"
    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";

  return (
    <div className="space-y-2 px-1">
      {memberships.length > 1 ? (
        <select
          value={currentOrgId ?? ""}
          onChange={(e) => switchOrg(e.target.value)}
          className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs"
        >
          {memberships.map((m) => (
            <option key={m.organization_id} value={m.organization_id}>
              {m.organizations?.name}
            </option>
          ))}
        </select>
      ) : (
        <p className="truncate text-sm font-medium text-foreground">{currentOrg.name}</p>
      )}
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${statusTone}`}>
          {statusLabel}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{role}</span>
      </div>
      <div className="flex flex-col gap-0.5 pt-1 text-xs">
        <Link to="/app/org" className="rounded px-1.5 py-1 text-muted-foreground hover:bg-accent hover:text-foreground">Overview</Link>
        <Link to="/app/org/insights" className="rounded px-1.5 py-1 text-muted-foreground hover:bg-accent hover:text-foreground">Insights</Link>
        <Link to="/app/org/members" className="rounded px-1.5 py-1 text-muted-foreground hover:bg-accent hover:text-foreground">Members</Link>
        <Link to="/app/org/billing" className="rounded px-1.5 py-1 text-muted-foreground hover:bg-accent hover:text-foreground">Billing & seats</Link>
        <Link to="/app/org/settings" className="rounded px-1.5 py-1 text-muted-foreground hover:bg-accent hover:text-foreground">Org settings</Link>
      </div>
    </div>
  );
}
