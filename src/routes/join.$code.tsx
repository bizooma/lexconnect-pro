import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PasswordInput } from "@/components/password-input";
import { toast } from "sonner";

export const Route = createFileRoute("/join/$code")({
  component: JoinByCode,
});

type Lookup = {
  organization_id: string;
  organization_name: string;
  organization_logo: string | null;
  role_assigned: string;
  valid: boolean;
};

function JoinByCode() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Mode: signup (default) or signin
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("lookup_invite_code", { _code: code });
      if (error) { setError(error.message); return; }
      const row = (data as Lookup[] | null)?.[0];
      if (!row) { setError("Invite code not found."); return; }
      if (!row.valid) { setError("This invite code is no longer valid."); return; }
      setLookup(row);
    })();
  }, [code]);

  const redeem = async () => {
    const { error } = await supabase.rpc("redeem_invite_code", { _code: code });
    if (error) throw error;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!user) {
        if (mode === "signup") {
          const { data, error: signErr } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/join/${code}`,
              data: { full_name: fullName },
            },
          });
          if (signErr) throw signErr;
          if (!data.session) {
            const { error: pwErr } = await supabase.auth.signInWithPassword({ email, password });
            if (pwErr) {
              toast.success("Check your email to confirm, then come back to this link.");
              return;
            }
          }
        } else {
          const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
          if (signErr) throw signErr;
        }
      }
      await redeem();
      if (lookup && typeof window !== "undefined") {
        window.localStorage.setItem("lexguild.currentOrgId", lookup.organization_id);
      }
      toast.success(`Welcome to ${lookup?.organization_name ?? "your organization"}`);
      navigate({ to: "/onboarding" });
    } catch (err: any) {
      setError(err.message ?? "Could not join.");
    } finally {
      setBusy(false);
    }
  };

  // If signed in already, just redeem on click
  const acceptAsExisting = async () => {
    setBusy(true);
    setError(null);
    try {
      await redeem();
      if (lookup && typeof window !== "undefined") {
        window.localStorage.setItem("lexguild.currentOrgId", lookup.organization_id);
      }
      toast.success(`Joined ${lookup?.organization_name}`);
      navigate({ to: "/app/dashboard" });
    } catch (err: any) {
      setError(err.message ?? "Could not join.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="px-5 py-5"><Logo /></header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-12">
        {error && !lookup && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-foreground">{error}</div>
        )}
        {!lookup && !error && <p className="text-sm text-muted-foreground">Checking invite…</p>}

        {lookup && (
          <>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">You're joining</p>
            <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-foreground">{lookup.organization_name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">As a <span className="capitalize">{lookup.role_assigned}</span></p>

            {authLoading ? (
              <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
            ) : user ? (
              <div className="mt-6 space-y-4">
                <p className="text-sm text-foreground">Signed in as <span className="font-medium">{user.email}</span></p>
                {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">{error}</div>}
                <button onClick={acceptAsExisting} disabled={busy}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant transition hover:bg-primary/90 disabled:opacity-60">
                  {busy ? "Joining…" : `Join ${lookup.organization_name}`}
                </button>
              </div>
            ) : (
              <>
                <div className="mt-6 inline-flex w-full rounded-lg border border-border bg-card p-1 text-sm">
                  <button onClick={() => setMode("signup")} className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${mode === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Create account</button>
                  <button onClick={() => setMode("signin")} className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${mode === "signin" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Sign in</button>
                </div>
                <form onSubmit={submit} className="mt-5 space-y-4">
                  {mode === "signup" && (
                    <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name"
                      className="block w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm shadow-card outline-none ring-ring/30 focus:ring-2" />
                  )}
                  <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
                    className="block w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm shadow-card outline-none ring-ring/30 focus:ring-2" />
                  <PasswordInput required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
                    className="block w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm shadow-card outline-none ring-ring/30 focus:ring-2" />
                  {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">{error}</div>}
                  <button type="submit" disabled={busy}
                    className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant transition hover:bg-primary/90 disabled:opacity-60">
                    {busy ? "Please wait…" : mode === "signup" ? "Create account & join" : "Sign in & join"}
                  </button>
                </form>
              </>
            )}
          </>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">← Back to home</Link>
        </p>
      </main>
    </div>
  );
}
