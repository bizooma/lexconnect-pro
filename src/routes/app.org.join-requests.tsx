import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { listOrgJoinRequests, approveJoinRequest, denyJoinRequest } from "@/lib/join-requests.functions";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import { toast } from "sonner";

export const Route = createFileRoute("/app/org/join-requests")({
  component: JoinRequestsPage,
});

type Req = Awaited<ReturnType<typeof listOrgJoinRequests>>["requests"][number];

function JoinRequestsPage() {
  const { currentOrgId, isOrgAdmin } = useCurrentOrg();
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const { requests } = await listOrgJoinRequests({ data: { organizationId: currentOrgId } });
      setRows(requests);
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (id: string) => {
    setBusy(id);
    try {
      await approveJoinRequest({ data: { requestId: id } });
      toast.success("Approved");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Approve failed");
    } finally {
      setBusy(null);
    }
  };
  const deny = async (id: string) => {
    setBusy(id);
    try {
      await denyJoinRequest({ data: { requestId: id } });
      toast.success("Denied");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Deny failed");
    } finally {
      setBusy(null);
    }
  };

  if (!currentOrgId) return <div className="p-8 text-sm text-muted-foreground">No organization selected.</div>;
  if (!isOrgAdmin) return <div className="p-8 text-sm text-muted-foreground">Only org admins can view join requests.</div>;

  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Organization</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-foreground">Join requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">People asking to join your organization via the portal domain.</p>
      </header>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <h2 className="mb-3 font-serif text-lg font-semibold">Pending ({pending.length})</h2>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending requests.</p>
            ) : (
              <ul className="divide-y divide-border">
                {pending.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-3">
                    <Avatar src={r.profile?.avatar_url ?? undefined} name={r.profile?.full_name ?? "User"} size={40} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{r.profile?.full_name ?? "Unknown user"}</div>
                      <div className="text-xs text-muted-foreground">Requested {new Date(r.created_at).toLocaleString()}</div>
                    </div>
                    <Button size="sm" onClick={() => approve(r.id)} disabled={busy === r.id}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => deny(r.id)} disabled={busy === r.id}>Deny</Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {decided.length > 0 && (
            <section className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-card">
              <h2 className="mb-3 font-serif text-lg font-semibold">Decided</h2>
              <ul className="divide-y divide-border">
                {decided.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-3 text-sm">
                    <Avatar src={r.profile?.avatar_url ?? undefined} name={r.profile?.full_name ?? "User"} size={32} />
                    <div className="flex-1">
                      <div className="font-medium">{r.profile?.full_name ?? "Unknown user"}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.status === "approved" ? "Approved" : "Denied"}
                        {r.decided_at ? ` · ${new Date(r.decided_at).toLocaleString()}` : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
