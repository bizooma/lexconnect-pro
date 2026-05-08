import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (tab === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app/dashboard`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        setInfo("Check your inbox to confirm your email, then sign in.");
        setTab("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/app/dashboard" });
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="px-5 py-5"><Logo /></header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-12">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
          {tab === "signin" ? "Welcome back" : "Join LexGuild"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {tab === "signin" ? "Sign in to your legal community." : "Create your professional profile."}
        </p>

        <div className="mt-6 inline-flex w-full rounded-lg border border-border bg-card p-1 text-sm">
          <button
            onClick={() => { setTab("signin"); setError(null); setInfo(null); }}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${tab === "signin" ? "bg-primary text-primary-foreground shadow-elegant" : "text-muted-foreground"}`}
          >Sign in</button>
          <button
            onClick={() => { setTab("signup"); setError(null); setInfo(null); }}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${tab === "signup" ? "bg-primary text-primary-foreground shadow-elegant" : "text-muted-foreground"}`}
          >Create account</button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {tab === "signup" && (
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">Full name</label>
              <input
                type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe, Esq."
                className="mt-1.5 block w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground shadow-card outline-none ring-ring/30 focus:ring-2"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@firm.com"
              className="mt-1.5 block w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground shadow-card outline-none ring-ring/30 focus:ring-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">Password</label>
            <input
              type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="mt-1.5 block w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground shadow-card outline-none ring-ring/30 focus:ring-2"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-foreground">{error}</div>
          )}
          {info && (
            <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-foreground">{info}</div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant transition hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? "Please wait…" : tab === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          {tab === "signin" ? (
            <>New to LexGuild?{" "}
              <button onClick={() => setTab("signup")} className="font-medium text-primary hover:underline">Create your profile</button>
            </>
          ) : (
            <>Already a member?{" "}
              <button onClick={() => setTab("signin")} className="font-medium text-primary hover:underline">Sign in</button>
            </>
          )}
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">← Back to home</Link>
        </p>
      </main>
    </div>
  );
}
