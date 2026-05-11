import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listAuthUsersSafe,
  deleteAuthUserSafe,
  setUserBannedSafe,
  setOrgAdminSafe,
  createUserAndAssignOrgSafe,
} from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, UserPlus } from "lucide-react";
import { toast } from "sonner";

function AdminUsersError({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-sm shadow-card">
      <p className="font-medium text-foreground">Users could not be loaded.</p>
      <p className="mt-1 text-muted-foreground">Refresh the users list to try again.</p>
      <Button
        className="mt-4"
        variant="outline"
        onClick={() => {
          router.invalidate();
          reset();
        }}
      >
        Retry
      </Button>
    </div>
  );
}

export const Route = createFileRoute("/app/admin/users")({
  component: AdminUsers,
  errorComponent: AdminUsersError,
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
type AuthUser = { id: string; email: string | null; created_at: string; banned: boolean };
type OrgMember = { user_id: string; organization_id: string; org_role: string; status: string };

function AdminUsers() {
  const fetchUsers = useServerFn(listAuthUsersSafe);
  const deleteUser = useServerFn(deleteAuthUserSafe);
  const setBanned = useServerFn(setUserBannedSafe);
  const setOrgAdmin = useServerFn(setOrgAdminSafe);
  const createUser = useServerFn(createUserAndAssignOrgSafe);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [authUsers, setAuthUsers] = useState<AuthUser[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; label: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addForm, setAddForm] = useState({
    email: "",
    fullName: "",
    password: "",
    organizationId: "",
    orgRole: "member" as "member" | "admin",
    sendInvite: true,
  });

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
      toast.error(e?.message ?? "Could not load auth users");
    }
    const [{ data: pData }, { data: oData }, { data: mData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,user_id,full_name,firm,is_mentor,is_mentee,organization_id")
        .order("created_at", { ascending: false }),
      supabase.from("organizations").select("id,name"),
      supabase
        .from("organization_members")
        .select("user_id,organization_id,org_role,status")
        .eq("status", "active"),
    ]);
    setProfiles((pData as Profile[] | null) ?? []);
    setOrgs((oData as Org[] | null) ?? []);
    setMembers((mData as OrgMember[] | null) ?? []);
    setAuthUsers(users);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orgById = useMemo(() => new Map(orgs.map((o) => [o.id, o])), [orgs]);
  const emailById = useMemo(
    () => new Map(authUsers.map((u) => [u.id, u.email ?? ""])),
    [authUsers],
  );
  const bannedById = useMemo(
    () => new Map(authUsers.map((u) => [u.id, u.banned])),
    [authUsers],
  );
  const orgRoleByUid = useMemo(() => {
    const m = new Map<string, string>();
    members.forEach((mem) => m.set(`${mem.user_id}:${mem.organization_id}`, mem.org_role));
    return m;
  }, [members]);

  type Row = {
    user_id: string;
    full_name: string | null;
    email: string;
    firm: string | null;
    org_name: string | null;
    organization_id: string | null;
    is_mentor: boolean;
    is_mentee: boolean;
    banned: boolean;
    org_role: string | null;
  };
  const rows: Row[] = useMemo(() => {
    const byUid = new Map<string, Row>();
    profiles.forEach((p) => {
      const role = p.organization_id
        ? orgRoleByUid.get(`${p.user_id}:${p.organization_id}`) ?? null
        : null;
      byUid.set(p.user_id, {
        user_id: p.user_id,
        full_name: p.full_name,
        email: emailById.get(p.user_id) ?? "",
        firm: p.firm,
        org_name: p.organization_id ? orgById.get(p.organization_id)?.name ?? null : null,
        organization_id: p.organization_id,
        is_mentor: p.is_mentor,
        is_mentee: p.is_mentee,
        banned: bannedById.get(p.user_id) ?? false,
        org_role: role,
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
          banned: u.banned,
          org_role: null,
        });
      }
    });
    return Array.from(byUid.values());
  }, [profiles, authUsers, emailById, orgById, bannedById, orgRoleByUid]);

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

  const withToken = async <T,>(fn: (token: string) => Promise<T>) => {
    const { data: sess } = await supabase.auth.getSession();
    return fn(sess.session?.access_token ?? "");
  };

  const onTogglePause = async (r: Row) => {
    setBusyId(r.user_id);
    try {
      const res = await withToken((accessToken) =>
        setBanned({ data: { accessToken, userId: r.user_id, banned: !r.banned } }),
      );
      if (res?.error) throw new Error(res.error);
      toast.success(r.banned ? "Access restored" : "User paused");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const onToggleOrgAdmin = async (r: Row) => {
    if (!r.organization_id) {
      toast.error("User is not in an organization");
      return;
    }
    const makeAdmin = r.org_role !== "admin" && r.org_role !== "owner";
    setBusyId(r.user_id);
    try {
      const res = await withToken((accessToken) =>
        setOrgAdmin({
          data: {
            accessToken,
            userId: r.user_id,
            organizationId: r.organization_id!,
            makeAdmin,
          },
        }),
      );
      if (res?.error) throw new Error(res.error);
      toast.success(makeAdmin ? "Promoted to org admin" : "Org admin revoked");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const onConfirmDelete = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    setBusyId(id);
    try {
      const res = await withToken((accessToken) =>
        deleteUser({ data: { accessToken, userId: id } }),
      );
      if (res?.error) throw new Error(res.error);
      toast.success("User deleted");
      setConfirmDelete(null);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const onCreateUser = async () => {
    if (!addForm.email.trim()) {
      toast.error("Email is required");
      return;
    }
    if (!addForm.organizationId) {
      toast.error("Pick an organization");
      return;
    }
    setAddBusy(true);
    try {
      const res = await withToken((accessToken) =>
        createUser({
          data: {
            accessToken,
            email: addForm.email.trim(),
            fullName: addForm.fullName.trim() || undefined,
            password: addForm.sendInvite ? undefined : addForm.password || undefined,
            organizationId: addForm.organizationId,
            orgRole: addForm.orgRole,
            sendInvite: addForm.sendInvite,
          },
        }),
      );
      if (res?.error) throw new Error(res.error);
      toast.success(addForm.sendInvite ? "Invite sent" : "User created");
      setAddOpen(false);
      setAddForm({
        email: "",
        fullName: "",
        password: "",
        organizationId: "",
        orgRole: "member",
        sendInvite: true,
      });
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create user");
    } finally {
      setAddBusy(false);
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
        <Button size="sm" onClick={() => setAddOpen(true)} className="ml-auto">
          <UserPlus className="mr-1 h-4 w-4" />
          Add user
        </Button>
        <p className="text-xs text-muted-foreground">{filtered.length} shown</p>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Email</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">Organization</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
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
              const isOrgAdmin = r.org_role === "admin" || r.org_role === "owner";
              const isOwner = r.org_role === "owner";
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
                      {r.banned && (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                          Paused
                        </span>
                      )}
                      {isOrgAdmin && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          {isOwner ? "Org owner" : "Org admin"}
                        </span>
                      )}
                      {r.is_mentor && (
                        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-medium text-gold">
                          Mentor
                        </span>
                      )}
                      {r.is_mentee && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Mentee
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={busyId === r.user_id}
                          aria-label="User actions"
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem
                          disabled={!r.organization_id || isOwner}
                          onClick={() => onToggleOrgAdmin(r)}
                        >
                          {isOrgAdmin ? "Revoke org admin" : "Make org admin"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onTogglePause(r)}>
                          {r.banned ? "Restore access" : "Pause access"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() =>
                            setConfirmDelete({
                              id: r.user_id,
                              label: r.full_name || r.email || r.user_id,
                            })
                          }
                        >
                          Delete user
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.label} will be permanently removed from authentication. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
