import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { toast } from "sonner";

export const Route = createFileRoute("/accept-invite/$token")({
  component: AcceptInvitePage,
});

type InviteRow = {
  id: string;
  organization_id: string;
  email: string;
  org_role: "owner" | "admin" | "content_editor" | "member";
  expires_at: string;
  accepted_at: string | null;
  organizations: { name: string } | null;
};

function AcceptInvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [invite, setInvite] = useState<InviteRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("organization_invites")
        .select("id, organization_id, email, org_role, expires_at, accepted_at, organizations(name)")
        .eq("token", token)
        .maybeSingle();
      if (error || !data) {
        setError("Invite not found or already used.");
      } else {
        setInvite(data as any);
        if (data.accepted_at) setError("This invite has already been accepted.");
        else if (new Date(data.expires_at) < new Date()) setError("This invite has expired.");
      }
      setLoading(false);
    })();
  }, [token]);

  const accept = async () => {
    if (!invite || !user) return;
    setWorking(true);
    const { error: memberErr } = await supabase.from("organization_members").insert({
      organization_id: invite.organization_id,
      user_id: user.id,
      org_role: invite.org_role,
      status: "active",
      joined_at: new Date().toISOString(),
      invited_email: invite.email,
    });
    if (memberErr && !memberErr.message.toLowerCase().includes("duplicate")) {
      setWorking(false);
      toast.error("Could not join", { description: memberErr.message });
      return;
    }
    await supabase
      .from("organization_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("lexguild.currentOrgId", invite.organization_id);
    }
    toast.success(`Joined ${invite.organizations?.name ?? "organization"}`);
    navigate({ to: "/app/dashboard" });
  };

  if (loading || authLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="px-5 py-4"><Logo /></header>
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-12">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          {error ? (
            <>
              <h1 className="font-serif text-2xl font-semibold text-foreground">Invite unavailable</h1>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
              <Button className="mt-6" onClick={() => navigate({ to: "/" })}>Go home</Button>
            </>
          ) : invite ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">You've been invited</p>
              <h1 className="mt-1 font-serif text-2xl font-semibold text-foreground">
                Join {invite.organizations?.name}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Role: <span className="font-medium text-foreground">{invite.org_role}</span> · for {invite.email}
              </p>

              {!user ? (
                <div className="mt-6 space-y-2">
                  <p className="text-sm text-muted-foreground">Sign in or create an account to accept.</p>
                  <Button
                    className="w-full"
                    onClick={() => navigate({ to: "/login" })}
                  >Sign in to continue</Button>
                </div>
              ) : (
                <Button className="mt-6 w-full" onClick={accept} disabled={working}>
                  {working ? "Joining…" : `Accept invite`}
                </Button>
              )}
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
