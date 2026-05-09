import { createFileRoute, Link, Outlet, useLocation, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/app" || location.pathname === "/app/") {
      throw redirect({ to: "/app/dashboard" });
    }
  },
  component: AppLayout,
});

const BASE_NAV = [
  { to: "/app/dashboard", label: "Home", icon: HomeIcon },
  { to: "/app/discover", label: "Discover", icon: SearchIcon },
  { to: "/app/messages", label: "Messages", icon: ChatIcon },
  { to: "/app/meetings", label: "Meetings", icon: CalIcon },
] as const;
const ADMIN_NAV = { to: "/app/admin", label: "Admin", icon: ShieldIcon } as const;

function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const NAV = isAdmin ? [...BASE_NAV, ADMIN_NAV] : BASE_NAV;
  const [profileName, setProfileName] = useState<string>("");

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login" });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfileName(data?.full_name ?? user.email ?? ""));
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const initials = (profileName || user.email || "?")
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-background lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="px-5 py-5"><Logo /></div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${active ? "bg-primary text-primary-foreground shadow-elegant" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-lg p-2">
            <Avatar initials={initials} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{profileName || user.email}</p>
              <button
                onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
                className="truncate text-xs text-muted-foreground hover:text-foreground"
              >Sign out</button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
          <Avatar initials={initials} size={36} />
        </button>
      </header>

      <main className="flex-1 pb-24 lg:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className="flex flex-col items-center gap-1 px-2 py-2.5">
                <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function HomeIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>; }
function SearchIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>; }
function ChatIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 12a8 8 0 0 1-12.3 6.7L3 20l1.3-5.7A8 8 0 1 1 21 12z"/></svg>; }
function CalIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>; }
function ShieldIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z"/></svg>; }
