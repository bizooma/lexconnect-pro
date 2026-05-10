import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listAuthUsers, setPlatformAdmin } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/users")({
  component: AdminUsers,
});

type Profile = {
  id: string;
  user_id: string;
  full_name: string | null;
  firm: string | null;
  is_mentor: boolean;
  is_mentee: boolean;
  organization_id: string | null;
};

type Org = { id: string; name: string };
type AuthUser = { id: string; email: string | null; created_at: string };

function AdminUsers() {
  const fetchUsers = useServerFn(listAuthUsers);
  const togglePlatformAdmin = useServerFn(setPlatformAdmin);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [authUsers, setAuthUsers] = useState<AuthUser[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    let users: AuthUser[] = [];
    try {
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess.session?.access_token ?? "";
      const result = await fetchUsers({ data: { accessToken } });
      users = result?.users ?? [];
      if (result?.error) toast.error(result.error);
    } catch (e: any) {
      const msg = e?.message ?? (typeof e === "string" ? e : "Could not load auth users");
      toast.error(msg);
    }
    const [{ data: pData }, { data: oData }, { data: rData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,user_id,full_name,firm,is_mentor,is_mentee,organization_id")
        .order("created_at", { ascending: false }),
      supabase.from("organizations").select("id,name"),
      supabase.from("user_roles").select("user_id,role").eq("role", "admin"),
    ]);
    setProfiles((pData as Profile[] | null) ?? []);
    setOrgs((oData as Org[] | null) ?? []);
    setAdminIds(new Set((rData ?? []).map((r: any) => r.user_id as string)));
    setAuthUsers(users);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orgById = useMemo(() => {
    const m = new Map<string, Org>();
    orgs.forEach((o) => m.set(o.id, o));
    return m;
  }, [orgs]);

  const emailById = useMemo(() => {
    const m = new Map<string, string>();
    authUsers.forEach((u) => m.set(u.id, u.email ?? ""));
    return m;
  }, [authUsers]);

  // Combine profiles + auth users (some auth users may have no profile yet)
  type Row = {
    user_id: string;
    full_name: string | null;
    email: string;
    firm: string | null;
    org_name: string | null;
    organization_id: string | null;
    is_mentor: boolean;
    is_mentee: boolean;
  };
  const rows: Row[] = useMemo(() => {
    const byUid = new Map<string, Row>();
    profiles.forEach((p) => {
      byUid.set(p.user_id, {
        user_id: p.user_id,
        full_name: p.full_name,
        email: emailById.get(p.user_id) ?? "",
        firm: p.firm,
        org_name: p.organization_id ? orgById.get(p.organization_id)?.name ?? null : null,
        organization_id: p.organization_id,
        is_mentor: p.is_mentor,
        is_mentee: p.is_mentee,
      });
    });
    authUsers.forEach((u) => {
      if (!byUid.has(u.id)) {
        byUid.set(u.id, {
          user_id: u.id,
          full_name: null,
          email: u.email ?? "",
          firm: null,
          org_name: null,
          organization_id: null,
          is_mentor: false,
          is_mentee: false,
        });
      }
    });
    return Array.from(byUid.values());
  }, [profiles, authUsers, emailById, orgById]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (orgFilter && r.organization_id !== orgFilter) return false;
      if (!q) return true;
      return [r.full_name, r.email, r.firm, r.org_name]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(q));
    });
  }, [rows, query, orgFilter]);

  const onToggleAdmin = async (userId: string, grant: boolean) => {
    setBusyId(userId);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess.session?.access_token ?? "";
      const res = await togglePlatformAdmin({ data: { accessToken, userId, grant } });
      if (res?.error) throw new Error(res.error);
      const next = new Set(adminIds);
      if (grant) next.add(userId);
      else next.delete(userId);
      setAdminIds(next);
      toast.success(grant ? "Granted platform admin" : "Revoked platform admin");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name, email, firm…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-md"
        />
        <select
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
          className="rounded-md border border-border bg-card px-2 py-2 text-sm"
        >
          <option value="">All organizations</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <p className="ml-auto text-xs text-muted-foreground">{filtered.length} shown</p>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Email</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">Organization</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Roles</th>
              <th className="px-4 py-3 text-right font-medium">Platform admin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Loading users…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No users found.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const isAdminUser = adminIds.has(r.user_id);
              return (
                <tr key={r.user_id} className="transition hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{r.full_name ?? "—"}</p>
                    {r.firm && <p className="text-xs text-muted-foreground">{r.firm}</p>}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {r.email || "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {r.org_name ?? "—"}
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {r.is_mentor && (
                        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-medium text-gold">
                          Mentor
                        </span>
                      )}
                      {r.is_mentee && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          Mentee
                        </span>
                      )}
                      {isAdminUser && (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                          Platform admin
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant={isAdminUser ? "outline" : "default"}
                      disabled={busyId === r.user_id}
                      onClick={() => onToggleAdmin(r.user_id, !isAdminUser)}
                    >
                      {busyId === r.user_id
                        ? "…"
                        : isAdminUser
                        ? "Revoke"
                        : "Grant"}
                    </Button>
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
