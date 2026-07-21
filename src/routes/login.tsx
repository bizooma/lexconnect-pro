import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { supabase } from "@/integrations/supabase/client";
import { PasswordInput } from "@/components/password-input";
import { usePortalContext, type PortalContext } from "@/hooks/use-portal-context";
import { requestJoin } from "@/lib/join-requests.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — LexGuild" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: Login,
});

function safeNext(next: string | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

type MembershipState =
  | { kind: "unknown" }
  | { kind: "member" }
  | { kind: "not-member"; userId: string };

function Login() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const nextPath = safeNext(next);
  const { portal, loading: portalLoading } = usePortalContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [membership, setMembership] = useState<MembershipState>({ kind: "unknown" });

  const accent = portal?.accent_color || undefined;

  const finishNonPortal = () => {
    if (nextPath) window.location.href = nextPath;
    else navigate({ to: "/app/dashboard" });
  };

  const checkMembership = async (userId: string, orgId: string) => {
    const { data } = await supabase
      .from("organization_members")
      .select("id, status")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    return Boolean(data);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const emailValue = ((fd.get("email") as string) || email).trim();
    const passwordValue = (fd.get("password") as string) || password;
    if (!emailValue || !passwordValue) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: emailValue, password: passwordValue });
      if (error) throw error;
      const userId = data.user?.id;
      if (portal && userId) {
        const isMember = await checkMembership(userId, portal.organizationId);
        if (isMember) {
          navigate({ to: "/app/dashboard" });
          return;
        }
        setMembership({ kind: "not-member", userId });
        return;
      }
      finishNonPortal();
    } catch (err: any) {
      setError(err.message ?? "Could not sign in.");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    const redirectTo = nextPath
      ? `${window.location.origin}${nextPath}`
      : `${window.location.origin}/app/dashboard`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
  };

  if (membership.kind === "not-member" && portal) {
    return <NotAMember portal={portal} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="px-5 py-5">
        <PortalHeader portal={portal} loading={portalLoading} />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-12">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
          {portal ? `Sign in to ${portal.name}` : "Welcome back"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {portal?.welcome_message || "Sign in to your legal community."}
        </p>

        <button
          onClick={google}
          className="mt-6 w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-card transition hover:bg-accent"
        >Continue with Google</button>

        <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</label>
            <input id="login-email" type="email" name="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@firm.com"
              className="mt-1.5 block w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground shadow-card outline-none ring-ring/30 focus:ring-2" />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">Password</label>
            <PasswordInput id="login-password" name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password"
              className="mt-1.5 block w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground shadow-card outline-none ring-ring/30 focus:ring-2" />
          </div>
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-foreground">{error}</div>}
          <button type="submit" disabled={loading} style={accent ? { backgroundColor: accent } : undefined}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant transition hover:opacity-90 disabled:opacity-60">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-8 space-y-2 text-center text-sm text-muted-foreground">
          {!portal && (
            <p>Launching a new community? <Link to="/signup" className="font-medium text-primary hover:underline">Create an organization</Link></p>
          )}
          <p>Got an invite? <Link to="/join" className="font-medium text-primary hover:underline">Join your organization</Link></p>
          {!portal && (
            <p className="pt-2 text-xs"><Link to="/" className="hover:underline">← Back to home</Link></p>
          )}
        </div>
      </main>
    </div>
  );
}

function PortalHeader({ portal, loading }: { portal: PortalContext | null; loading: boolean }) {
  if (loading) return <div className="h-8 w-32 animate-pulse rounded bg-muted" />;
  if (!portal) return <Logo />;
  return (
    <div className="flex items-center gap-3">
      {portal.logo_url ? (
        <img src={portal.logo_url} alt={portal.name} className="h-10 w-auto max-w-[180px] object-contain" />
      ) : (
        <div className="font-serif text-lg font-semibold text-foreground">{portal.name}</div>
      )}
    </div>
  );
}

function NotAMember({ portal }: { portal: PortalContext }) {
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  const redeem = async () => {
    if (!token.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("redeem_invite", { _token: token.trim() });
      if (error) throw error;
      toast.success("Welcome to " + portal.name);
      window.location.href = "/app/dashboard";
    } catch (err: any) {
      setError(err.message ?? "Could not accept invite.");
    } finally {
      setSubmitting(false);
    }
  };

  const askAccess = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await requestJoin();
      setRequested(true);
    } catch (err: any) {
      setError(err.message ?? "Could not submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  const accent = portal.accent_color || undefined;
  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="px-5 py-5">
        <PortalHeader portal={portal} loading={false} />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-12">
        <h1 className="font-serif text-2xl font-semibold text-foreground">You're not a member of {portal.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account exists, but you don't have access to this portal yet.
        </p>

        {portal.join_policy === "invite_only" ? (
          <div className="mt-6 space-y-3">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">Invite token</label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your invite token"
              className="block w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm shadow-card outline-none ring-ring/30 focus:ring-2"
            />
            <button
              onClick={redeem}
              disabled={submitting || !token.trim()}
              style={accent ? { backgroundColor: accent } : undefined}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant transition hover:opacity-90 disabled:opacity-60"
            >{submitting ? "Joining…" : "Accept invite"}</button>
            <p className="text-xs text-muted-foreground">Ask an administrator at {portal.name} to email you an invite.</p>
          </div>
        ) : requested ? (
          <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground">
            Your request to join {portal.name} has been submitted. An administrator will review it shortly.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <button
              onClick={askAccess}
              disabled={submitting}
              style={accent ? { backgroundColor: accent } : undefined}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant transition hover:opacity-90 disabled:opacity-60"
            >{submitting ? "Sending…" : "Request access"}</button>
            <p className="text-xs text-muted-foreground">An administrator at {portal.name} will review your request.</p>
          </div>
        )}

        {error && <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">{error}</div>}

        <button onClick={signOut} className="mt-8 text-xs text-muted-foreground hover:text-foreground">Sign out</button>
      </main>
    </div>
  );
}
