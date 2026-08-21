import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { listCustomDomainsSafe, setDomainLovableConnectedSafe } from "@/lib/admin.functions";

export const Route = createFileRoute("/app/admin/domains")({
  component: AdminDomains,
});

type Row = {
  id: string;
  domain: string;
  mode: string | null;
  verified_at: string | null;
  lovable_connected: boolean;
  lovable_connected_at: string | null;
  orgName: string;
};

function AdminDomains() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const res = await listCustomDomainsSafe({
      data: { accessToken: sess.session?.access_token ?? "" },
    });
    if (!res.ok) {
      toast.error(res.error ?? "Failed to load domains");
      setRows([]);
      return;
    }
    setRows(res.domains as Row[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(row: Row, connected: boolean) {
    setBusy(row.id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await setDomainLovableConnectedSafe({
        data: {
          accessToken: sess.session?.access_token ?? "",
          domainId: row.id,
          connected,
        },
      });
      if (!res.ok) {
        toast.error(res.error ?? "Update failed");
        return;
      }
      toast.success(connected ? "Marked as connected" : "Marked as not connected");
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium text-foreground">Custom domains</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Verified domains that aren&apos;t connected yet appear first — add them in the Lovable
          dashboard (Settings → Domains, do not set primary), then flip the toggle.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="px-4 py-3 font-medium">Domain</th>
              <th className="px-4 py-3 font-medium">Mode</th>
              <th className="px-4 py-3 font-medium">Verified</th>
              <th className="px-4 py-3 font-medium">Connected in Lovable</th>
            </tr>
          </thead>
          <tbody>
            {rows === null && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-muted-foreground">
                  No custom domains yet.
                </td>
              </tr>
            )}
            {rows?.map((r) => {
              const todo = !!r.verified_at && !r.lovable_connected;
              return (
                <tr
                  key={r.id}
                  className={`border-t border-border ${todo ? "bg-gold/5" : ""}`}
                >
                  <td className="px-4 py-3 text-foreground">{r.orgName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{r.domain}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{r.mode ?? "site"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.verified_at ? new Date(r.verified_at).toLocaleDateString() : "Pending"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={r.lovable_connected}
                        disabled={busy === r.id}
                        onCheckedChange={(v) => toggle(r, v)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {r.lovable_connected
                          ? r.lovable_connected_at
                            ? new Date(r.lovable_connected_at).toLocaleDateString()
                            : "Connected"
                          : todo
                            ? "Needs connection"
                            : "—"}
                      </span>
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
