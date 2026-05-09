import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { supabase } from "@/integrations/supabase/client";
import { PasswordInput } from "@/components/password-input";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — LexGuild" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/app/dashboard" });
    } catch (err: any) {
      setError(err.message ?? "Could not sign in.");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/app/dashboard` },
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="px-5 py-5"><Logo /></header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-12">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">Welcome back</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Sign in to your legal community.</p>

        <button
          onClick={google}
          className="mt-6 w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-card transition hover:bg-accent"
        >Continue with Google</button>

        <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@firm.com"
              className="mt-1.5 block w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground shadow-card outline-none ring-ring/30 focus:ring-2" />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">Password</label>
            <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password"
              className="mt-1.5 block w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground shadow-card outline-none ring-ring/30 focus:ring-2" />
          </div>
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-foreground">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant transition hover:bg-primary/90 disabled:opacity-60">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-8 space-y-2 text-center text-sm text-muted-foreground">
          <p>Launching a new community? <Link to="/signup" className="font-medium text-primary hover:underline">Create an organization</Link></p>
          <p>Got an invite? <Link to="/join" className="font-medium text-primary hover:underline">Join your organization</Link></p>
          <p className="pt-2 text-xs"><Link to="/" className="hover:underline">← Back to home</Link></p>
        </div>
      </main>
    </div>
  );
}
