import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/join/")({
  component: JoinIndex,
});

function JoinIndex() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    navigate({ to: "/join/$code", params: { code: c } });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-5 py-5">
        <Logo />
        <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-12">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">Join your organization</h1>
        <p className="mt-2 text-sm text-muted-foreground">Enter the invite code your organization shared with you.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD1234"
            className="block w-full rounded-lg border border-input bg-card px-3.5 py-3 text-center font-mono text-lg tracking-widest text-foreground shadow-card outline-none ring-ring/30 focus:ring-2" />
          <button type="submit" disabled={!code.trim()}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant transition hover:bg-primary/90 disabled:opacity-50">
            Continue
          </button>
        </form>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Don't have a code? Ask your organization administrator. <br />
          <Link to="/" className="hover:underline">← Back to home</Link>
        </p>
      </main>
    </div>
  );
}
