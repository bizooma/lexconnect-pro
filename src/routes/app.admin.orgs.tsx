import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { setOrgPausedSafe } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/orgs")({
  component: AdminOrgs,
});

type Org = {
  id: string;
  name: string;
  slug: string;
  kind: "firm" | "bar_association";
  created_at: string;
  paused: boolean;
};

type Sub = {
  organization_id: string;
  status: string;
  plan: string;
  seats_purchased: number;
  max_users: number | null;
};

const LS_KEY = "lexguild.currentOrgId";

function AdminOrgs() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const setOrgPaused = useServerFn(setOrgPausedSafe);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: orgData }, { data: subData }, { data: memberData }] = await Promise.all([
        supabase
          .from("organizations")
          .select("id,name,slug,kind,created_at,paused")
          .order("created_at", { ascending: false }),
        supabase
          .from("subscriptions")
          .select("organization_id,status,plan,seats_purchased,max_users"),
        supabase
          .from("organization_members")
          .select("organization_id,status")
          .eq("status", "active"),
      ]);
      setOrgs((orgData as Org[] | null) ?? []);
      setSubs((subData as Sub[] | null) ?? []);
      const counts: Record<string, number> = {};
      (memberData ?? []).forEach((m: any) => {
        counts[m.organization_id] = (counts[m.organization_id] ?? 0) + 1;
      });
      setMemberCounts(counts);
      setLoading(false);
    })();
  }, []);

  const subByOrg = useMemo(() => {
    const m = new Map<string, Sub>();
    subs.forEach((s) => m.set(s.organization_id, s));
    return m;
  }, [subs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter(
      (o) => o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q),
    );
  }, [orgs, query]);

  const switchTo = (orgId: string) => {
    if (typeof window !== "undefined") window.localStorage.setItem(LS_KEY, orgId);
    toast.success("Switched organization context");
    navigate({ to: "/app/org" });
    setTimeout(() => window.location.reload(), 100);
  };

  const togglePause = async (org: Org) => {
    if (!session?.access_token) {
      toast.error("Session expired");
      return;
    }
    setBusyId(org.id);
    const next = !org.paused;
    const res = await setOrgPaused({
      data: { accessToken: session.access_token, organizationId: org.id, paused: next },
    });
    setBusyId(null);
    if (res.ok) {
      setOrgs((prev) => prev.map((o) => (o.id === org.id ? { ...o, paused: next } : o)));
      toast.success(next ? "Organization paused" : "Organization restored");
    } else {
      toast.error(res.error ?? "Failed");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Search organizations…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-md"
        />
        <p className="text-xs text-muted-foreground">{orgs.length} total</p>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Kind</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Members</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">Plan</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Loading organizations…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No organizations found.
                </td>
              </tr>
            )}
            {filtered.map((o) => {
              const sub = subByOrg.get(o.id);
              return (
                <tr key={o.id} className="transition hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{o.name}</p>
                      {o.paused && (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                          Paused
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">/{o.slug}</p>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {o.kind === "bar_association" ? "Bar Assoc." : "Firm"}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {memberCounts[o.id] ?? 0}
                  </td>
                  <td className="hidden px-4 py-3 capitalize text-muted-foreground lg:table-cell">
                    {sub?.plan ?? "—"}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    {sub ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-foreground">
                        {sub.status}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant={o.paused ? "default" : "outline"}
                        disabled={busyId === o.id}
                        onClick={() => togglePause(o)}
                      >
                        {o.paused ? "Restore" : "Pause"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => switchTo(o.id)}>
                        Open
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
