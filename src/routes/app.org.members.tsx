import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar } from "@/components/avatar";
import { toast } from "sonner";

export const Route = createFileRoute("/app/org/members")({
  component: OrgMembersPage,
});

type Member = {
  id: string;
  user_id: string | null;
  org_role: "owner" | "admin" | "content_editor" | "member";
  status: "active" | "invited" | "removed";
  invited_email: string | null;
  joined_at: string | null;
  profile?: { full_name: string | null; avatar_url: string | null; headline: string | null } | null;
};

type Invite = {
  id: string;
  email: string;
  org_role: "owner" | "admin" | "content_editor" | "member";
  token: string;
  expires_at: string;
  accepted_at: string | null;
};

type InviteCode = {
  id: string;
  code: string;
  role_assigned: "owner" | "admin" | "content_editor" | "member";
  expires_at: string | null;
  max_uses: number | null;
  current_uses: number;
  active: boolean;
};

function OrgMembersPage() {
  const { user } = useAuth();
  const { currentOrgId, currentOrg, isOrgAdmin, role, subscription } = useCurrentOrg();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "content_editor" | "admin">("member");
  const [submitting, setSubmitting] = useState(false);
  const [bulkEmails, setBulkEmails] = useState("");

  const refresh = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    const { data: rows } = await supabase
      .from("organization_members")
      .select("id,user_id,org_role,status,invited_email,joined_at")
      .eq("organization_id", currentOrgId);
    const userIds = (rows ?? []).map((r) => r.user_id).filter(Boolean) as string[];
    const { data: profs } = userIds.length
      ? await supabase.from("profiles").select("user_id,full_name,avatar_url,headline").in("user_id", userIds)
      : { data: [] as any[] };
    const profMap = new Map((profs ?? []).map((p) => [p.user_id, p]));
    setMembers(((rows ?? []) as any).map((r: any) => ({ ...r, profile: profMap.get(r.user_id) ?? null })));

    const { data: inv } = await supabase
      .from("organization_invites")
      .select("id,email,org_role,token,expires_at,accepted_at")
      .eq("organization_id", currentOrgId)
      .is("accepted_at", null);
    setInvites((inv ?? []) as Invite[]);

    const { data: ic } = await supabase
      .from("invite_codes")
      .select("id,code,role_assigned,expires_at,max_uses,current_uses,active")
      .eq("organization_id", currentOrgId)
      .order("created_at", { ascending: false });
    setCodes((ic ?? []) as InviteCode[]);

    setLoading(false);
  }, [currentOrgId]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Mirror the DB-side enforce_seat_limit trigger: only organization_members rows
  // in ('active','invited') consume a seat. Pending organization_invites rows do not
  // reserve seats until the invitee accepts and a member row is created.
  const seatsUsed = members.filter((m) => m.status === "active" || m.status === "invited").length;
  const seatsCap = subscription?.seats_purchased ?? 0;

  const sendInvite = async () => {
    if (!currentOrgId || !user) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setSubmitting(true);
    const token = crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase.from("organization_invites").insert({
      organization_id: currentOrgId,
      email,
      org_role: inviteRole,
      token,
      invited_by: user.id,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Could not create invite", { description: error.message });
      return;
    }
    const link = `${window.location.origin}/accept-invite/${token}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    toast.success("Invite created — link copied", { description: email });
    setInviteEmail("");
    void refresh();
  };

  const cancelInvite = async (id: string) => {
    const { error } = await supabase.from("organization_invites").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Invite canceled");
    void refresh();
  };

  const copyInvite = async (token: string) => {
    const link = `${window.location.origin}/accept-invite/${token}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    toast.success("Invite link copied");
  };

  const generateCode = async () => {
    if (!currentOrgId || !user) return;
    const code = Array.from({ length: 8 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 30)]).join("");
    const { error } = await supabase.from("invite_codes").insert({
      organization_id: currentOrgId,
      code,
      role_assigned: inviteRole,
      created_by: user.id,
    });
    if (error) return toast.error("Could not create code", { description: error.message });
    const link = `${window.location.origin}/join/${code}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    toast.success("Invite code created — link copied", { description: code });
    void refresh();
  };

  const toggleCode = async (id: string, active: boolean) => {
    const { error } = await supabase.from("invite_codes").update({ active }).eq("id", id);
    if (error) return toast.error(error.message);
    void refresh();
  };

  const copyCodeLink = async (code: string) => {
    const link = `${window.location.origin}/join/${code}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    toast.success("Link copied");
  };

  const bulkInvite = async () => {
    if (!currentOrgId || !user) return;
    const emails = bulkEmails
      .split(/[\s,;\n]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /\S+@\S+\.\S+/.test(s));
    if (!emails.length) return toast.error("No valid emails found");
    const rows = emails.map((email) => ({
      organization_id: currentOrgId,
      email,
      org_role: "member" as const,
      token: crypto.randomUUID().replace(/-/g, ""),
      invited_by: user.id,
    }));
    const { error } = await supabase.from("organization_invites").insert(rows);
    if (error) return toast.error("Bulk invite failed", { description: error.message });
    toast.success(`${emails.length} invites created`);
    setBulkEmails("");
    void refresh();
  };

  const changeRole = async (memberId: string, newRole: "owner" | "admin" | "content_editor" | "member") => {
    const { error } = await supabase.from("organization_members").update({ org_role: newRole }).eq("id", memberId);
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    void refresh();
  };

  const removeMember = async (memberId: string) => {
    if (!confirm("Remove this member from the organization?")) return;
    const { error } = await supabase.from("organization_members").delete().eq("id", memberId);
    if (error) return toast.error(error.message);
    toast.success("Member removed");
    void refresh();
  };

  if (!currentOrgId) {
    return <div className="p-8 text-sm text-muted-foreground">No organization selected.</div>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Organization</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-foreground">{currentOrg?.name} members</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {seatsUsed} of {seatsCap || "∞"} seats used · your role: <span className="font-medium text-foreground">{role}</span>
        </p>
      </header>

      {isOrgAdmin && (
        <section className="mb-8 rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-serif text-lg font-semibold text-foreground">Invite a member</h2>
          <p className="mt-1 text-sm text-muted-foreground">They'll get a one-time link valid for 14 days.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Input
              type="email"
              placeholder="lawyer@firm.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1"
            />
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)}>
              <SelectTrigger className="sm:w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="content_editor">Content Editor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={sendInvite} disabled={submitting || !inviteEmail}>
              {submitting ? "Sending…" : "Create invite"}
            </Button>
          </div>
          {seatsCap > 0 && seatsUsed >= seatsCap && (
            <p className="mt-3 text-xs text-destructive">Seat limit reached. Increase seats in Billing first.</p>
          )}
        </section>
      )}

      {isOrgAdmin && (
        <section className="mb-8 rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-serif text-lg font-semibold text-foreground">Shareable invite codes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One link or code that anyone can use. Great for QR codes, conferences, or email blasts.
          </p>
          <div className="mt-4">
            <Button onClick={generateCode}>Generate invite code</Button>
          </div>
          {codes.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              {codes.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 border-b border-border bg-background/50 px-4 py-3 last:border-b-0">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium tracking-wider text-foreground">{c.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.role_assigned} · {c.current_uses} use{c.current_uses === 1 ? "" : "s"} · {c.active ? "active" : "disabled"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyCodeLink(c.code)}>Copy link</Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleCode(c.id, !c.active)}>
                      {c.active ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {isOrgAdmin && (
        <section className="mb-8 rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-serif text-lg font-semibold text-foreground">Bulk invite</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste emails (commas, spaces, or new lines). Each gets their own one-time link.
          </p>
          <textarea
            value={bulkEmails}
            onChange={(e) => setBulkEmails(e.target.value)}
            rows={4}
            placeholder="alice@firm.com, bob@firm.com&#10;carol@firm.com"
            className="mt-3 block w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm shadow-card outline-none ring-ring/30 focus:ring-2"
          />
          <div className="mt-3">
            <Button onClick={bulkInvite} disabled={!bulkEmails.trim()}>Send invites</Button>
          </div>
        </section>
      )}

      {invites.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pending invites</h2>
          <div className="overflow-hidden rounded-xl border border-border">
            {invites.map((i) => (
              <div key={i.id} className="flex items-center justify-between border-b border-border bg-card px-4 py-3 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{i.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.org_role} · expires {new Date(i.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => copyInvite(i.token)}>Copy link</Button>
                  {isOrgAdmin && (
                    <Button variant="ghost" size="sm" onClick={() => cancelInvite(i.id)}>Cancel</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Members</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            {members.map((m) => {
              const initials = (m.profile?.full_name ?? m.invited_email ?? "?")
                .split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
              return (
                <div key={m.id} className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 last:border-b-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar initials={initials} src={m.profile?.avatar_url ?? null} size={36} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {m.profile?.full_name ?? m.invited_email ?? "—"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{m.profile?.headline ?? m.status}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOrgAdmin && m.user_id !== user?.id ? (
                      <Select value={m.org_role} onValueChange={(v) => changeRole(m.id, v as any)}>
                        <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="content_editor">Content Editor</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="owner">Owner</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {m.org_role}
                      </span>
                    )}
                    {isOrgAdmin && m.user_id !== user?.id && (
                      <Button variant="ghost" size="sm" onClick={() => removeMember(m.id)}>Remove</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
