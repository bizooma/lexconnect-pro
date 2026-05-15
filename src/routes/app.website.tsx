import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useIsAdmin } from "@/hooks/use-is-admin";

export const Route = createFileRoute("/app/website")({
  component: WebsiteLayout,
});

const TABS: Array<{ to: string; label: string; exact?: boolean }> = [
  { to: "/app/website", label: "Overview", exact: true },
  { to: "/app/website/pages", label: "Pages" },
  { to: "/app/website/templates", label: "Templates" },
  { to: "/app/website/brand", label: "Brand" },
];

function WebsiteLayout() {
  const { pathname } = useLocation();
  const { isOrgAdmin, currentOrg, loading } = useCurrentOrg();
  const { isAdmin, checking } = useIsAdmin();

  if (loading || checking) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!isOrgAdmin && !isAdmin) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold text-foreground">Website Builder</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only organization administrators can access the Website Builder.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="px-6 pt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="font-serif text-2xl font-semibold text-foreground">Website Builder</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {currentOrg?.name ? `Build and manage ${currentOrg.name}'s pages.` : "Build and manage your organization's pages."}
              </p>
            </div>
          </div>
          <nav className="mt-5 -mb-px flex gap-6 overflow-x-auto">
            {TABS.map((t) => {
              const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition ${
                    active
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <div className="p-6">
        <Outlet />
      </div>
    </div>
  );
}
