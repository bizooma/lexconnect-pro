import { createFileRoute, Link, Outlet, useLocation, useNavigate, redirect } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useIsPlatformAdmin } from "@/hooks/use-is-platform-admin";
import { supabase } from "@/integrations/supabase/client";
import { NotificationsBell } from "@/components/notifications-bell";
import { CurrentOrgProvider, useCurrentOrg } from "@/hooks/use-current-org";
import { OrgSwitcher } from "@/components/org-switcher";
import { usePortalTheme } from "@/components/portal-theme-provider";

export const Route = createFileRoute("/app")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/app" || location.pathname === "/app/") {
      throw redirect({ to: "/app/dashboard" });
    }
  },
  component: () => (
    <CurrentOrgProvider>
      <AppLayout />
    </CurrentOrgProvider>
  ),
});



type NavItem = {
  to: string;
  label: string;
  icon: (p: any) => React.ReactElement;
  enabled: boolean;
  locked?: boolean;
};

const CORE_NAV_DEF = [
  { to: "/app/dashboard", label: "Home", icon: HomeIcon },
  { to: "/app/discover", label: "Discover", icon: SearchIcon },
  { to: "/app/qa", label: "Community Q&A", icon: QaIcon },
  { to: "/app/messages", label: "Messages", icon: ChatIcon },
  { to: "/app/meetings", label: "Meetings", icon: CalIcon },
  { to: "/app/activity", label: "Activity", icon: ActivityIcon },
] as const;

function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { isPlatformAdmin } = useIsPlatformAdmin();
  const { currentOrg, canEditWebsite } = useCurrentOrg();
  const { portal, displayName: portalName, showPoweredBy } = usePortalTheme();
  const brandLogo = portal?.logo_url ?? currentOrg?.logo_url ?? null;
  const brandName = portalName ?? currentOrg?.name ?? null;


  const coreNav: NavItem[] = CORE_NAV_DEF.map((i) => ({ ...i, enabled: true }));
  const addonNav: NavItem[] = [
    {
      to: "/app/website",
      label: "Website Builder",
      icon: GlobeIcon,
      enabled: isPlatformAdmin,
      locked: !isPlatformAdmin,
    },
    {
      to: "/app/directory",
      label: "Attorney Directory",
      icon: BookIcon,
      enabled: isPlatformAdmin,
      locked: !isPlatformAdmin,
    },
    {
      to: "/app/ce",
      label: "CE Learning",
      icon: GraduationIcon,
      enabled: true,
    },
  ];
  const platformNav: NavItem[] = isAdmin
    ? [{ to: "/app/admin", label: "Admin", icon: ShieldIcon, enabled: true }]
    : [];

  const [profileName, setProfileName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user || isAdmin) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("organization_members")
        .select("organizations(paused)")
        .eq("user_id", user.id)
        .eq("status", "active");
      if (cancelled) return;
      const rows = (data ?? []) as { organizations: { paused: boolean } | null }[];
      if (rows.length === 0) return;
      const hasUnpaused = rows.some((r) => r.organizations && !r.organizations.paused);
      if (!hasUnpaused) {
        toast.error("Your organization is paused. Please contact your administrator.");
        await signOut();
        navigate({ to: "/login" });
      }
    })();
    return () => { cancelled = true; };
  }, [user, isAdmin, signOut, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfileName(data?.full_name ?? user.email ?? "");
        setAvatarUrl(data?.avatar_url ?? null);
      });
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

  // Mobile bottom nav: keep 5 core + a "More" entry that links to dashboard groups page
  const mobileNav = coreNav.slice(0, 5);

  const handleLockedClick = () => {
    toast.message("Add-on not enabled", {
      description: "This module isn't included in your plan yet. Contact your administrator to enable it.",
    });
  };

  const renderDesktopItem = (item: NavItem) => {
    const active = pathname.startsWith(item.to);
    const Icon = item.icon;
    const baseClass = "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition";
    if (!item.enabled) {
      return (
        <button
          key={item.to}
          type="button"
          onClick={handleLockedClick}
          className={`${baseClass} w-full text-left text-muted-foreground/70 hover:bg-accent/40`}
          title="Add-on not enabled"
        >
          <Icon className="h-4 w-4 opacity-60" />
          <span className="flex-1 truncate">{item.label}</span>
          <LockIcon className="h-3.5 w-3.5 opacity-70" />
        </button>
      );
    }
    return (
      <Link
        key={item.to}
        to={item.to}
        className={`${baseClass} ${active ? "bg-primary text-primary-foreground shadow-elegant" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
      >
        <Icon className="h-4 w-4" />
        {item.label}
      </Link>
    );
  };

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
      {children}
    </p>
  );

  return (
    <div className="min-h-screen bg-background lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="px-5 py-5">
          {brandLogo ? (
            <Link to="/app/dashboard" className="flex items-center gap-3">
              <img
                src={brandLogo}
                alt={`${brandName ?? "Organization"} logo`}
                className="h-14 w-14 shrink-0 rounded-lg border border-border bg-background object-contain p-1"
              />
              <span className="truncate font-serif text-base font-semibold text-foreground">{brandName}</span>
            </Link>
          ) : (
            <Logo />
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          <SectionLabel>Mentorship & Community</SectionLabel>
          <div className="space-y-1">{coreNav.map(renderDesktopItem)}</div>

          <SectionLabel>Add-ons</SectionLabel>
          <div className="space-y-1">{addonNav.map(renderDesktopItem)}</div>

          {platformNav.length > 0 && (
            <>
              <SectionLabel>Platform</SectionLabel>
              <div className="space-y-1">{platformNav.map(renderDesktopItem)}</div>
            </>
          )}
        </nav>
        <div className="border-t border-border p-3">
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Account</span>
            <NotificationsBell />
          </div>
          <div className="mb-3"><OrgSwitcher /></div>
          <Link to="/app/settings" className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent">
            <Avatar initials={initials} src={avatarUrl} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{profileName || user.email}</p>
              <p className="truncate text-xs text-muted-foreground">Profile settings</p>
            </div>
          </Link>
          <button
            onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
            className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >Sign out</button>
          {portal && showPoweredBy && (
            <a
              href="https://lexguild.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >Powered by LexGuild</a>
          )}
        </div>

      </aside>

      {/* Mobile top bar */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 pb-3 backdrop-blur lg:hidden"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        {brandLogo ? (
          <Link to="/app/dashboard" className="flex items-center gap-2 min-w-0">
            <img
              src={brandLogo}
              alt={`${brandName ?? "Organization"} logo`}
              className="h-9 w-9 shrink-0 rounded-lg border border-border bg-background object-contain p-0.5"
            />
            <span className="truncate font-serif text-sm font-semibold text-foreground">{brandName}</span>
          </Link>
        ) : (
          <Logo />
        )}

        <div className="flex items-center gap-1">
          <NotificationsBell />
          <Link to="/app/settings">
            <Avatar initials={initials} src={avatarUrl} size={36} />
          </Link>
        </div>
      </header>

      <main className="flex-1 pb-24 lg:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-2xl items-stretch overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {mobileNav.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className="flex min-w-[64px] flex-1 flex-col items-center gap-1 px-2 py-2.5">
                <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>{item.label}</span>
              </Link>
            );
          })}
          <MobileMoreMenu addonNav={addonNav} platformNav={platformNav} pathname={pathname} onLocked={handleLockedClick} />
        </div>
      </nav>
    </div>
  );
}

function MobileMoreMenu({
  addonNav,
  platformNav,
  pathname,
  onLocked,
}: {
  addonNav: NavItem[];
  platformNav: NavItem[];
  pathname: string;
  onLocked: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-w-[64px] flex-1 flex-col items-center gap-1 px-2 py-2.5"
      >
        <MoreIcon className="h-5 w-5 text-muted-foreground" />
        <span className="text-[10px] font-medium text-muted-foreground">More</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-40 flex items-end bg-background/60 backdrop-blur" onClick={() => setOpen(false)}>
          <div
            className="w-full rounded-t-2xl border-t border-border bg-card p-4"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">Add-ons</p>
            <div className="space-y-1">
              {addonNav.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.to);
                if (!item.enabled) {
                  return (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => { onLocked(); setOpen(false); }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground/70"
                    >
                      <Icon className="h-4 w-4 opacity-60" />
                      <span className="flex-1 text-left">{item.label}</span>
                      <LockIcon className="h-3.5 w-3.5 opacity-70" />
                    </button>
                  );
                }
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"}`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
            {platformNav.length > 0 && (
              <>
                <p className="px-1 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">Platform</p>
                <div className="space-y-1">
                  {platformNav.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function HomeIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>; }
function SearchIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>; }
function ChatIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 12a8 8 0 0 1-12.3 6.7L3 20l1.3-5.7A8 8 0 1 1 21 12z"/></svg>; }
function CalIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>; }
function ShieldIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z"/></svg>; }
function ActivityIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>; }
function QaIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M7 8h10M7 12h6"/><path d="M21 12a8 8 0 0 1-12.3 6.7L3 20l1.3-5.7A8 8 0 1 1 21 12z"/></svg>; }
function GlobeIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>; }
function BookIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4z"/><path d="M4 17a3 3 0 0 1 3-3h11"/></svg>; }
function GraduationIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M2 9l10-5 10 5-10 5L2 9z"/><path d="M6 11v5c2 2 10 2 12 0v-5"/></svg>; }
function LockIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>; }
function MoreIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>; }
