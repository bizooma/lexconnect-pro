import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [sent, setSent] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="px-5 py-5"><Logo /></header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-12">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">Welcome back</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Sign in to your legal community.</p>

        <div className="mt-6 inline-flex w-full rounded-lg border border-border bg-card p-1 text-sm">
          <button
            onClick={() => { setMode("password"); setSent(false); }}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${mode === "password" ? "bg-primary text-primary-foreground shadow-elegant" : "text-muted-foreground"}`}
          >Password</button>
          <button
            onClick={() => { setMode("magic"); setSent(false); }}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${mode === "magic" ? "bg-primary text-primary-foreground shadow-elegant" : "text-muted-foreground"}`}
          >Magic link</button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "magic") setSent(true);
            else navigate({ to: "/app/dashboard" });
          }}
          className="mt-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</label>
            <input
              type="email" required defaultValue="christopher@barassoc.org"
              className="mt-1.5 block w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground shadow-card outline-none ring-ring/30 focus:ring-2"
            />
          </div>
          {mode === "password" && (
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">Password</label>
                <button type="button" className="text-xs font-medium text-primary hover:underline">Forgot?</button>
              </div>
              <input
                type="password" required defaultValue="••••••••"
                className="mt-1.5 block w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground shadow-card outline-none ring-ring/30 focus:ring-2"
              />
            </div>
          )}

          {sent ? (
            <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-foreground">
              Magic link sent. Check your inbox to continue.
            </div>
          ) : (
            <button
              type="submit"
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant transition hover:bg-primary/90"
            >
              {mode === "magic" ? "Send magic link" : "Sign in"}
            </button>
          )}
        </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          New to BridgeTRUST?{" "}
          <Link to="/onboarding" className="font-medium text-primary hover:underline">Create your profile</Link>
        </p>
      </main>
    </div>
  );
}
