import { createFileRoute, Link, Navigate, Outlet, useLocation } from "@tanstack/react-router";
import { useIsAdmin } from "@/hooks/use-is-admin";

export const Route = createFileRoute("/app/admin")({
  component: AdminLayout,
});

const TABS = [
  { to: "/app/admin", label: "Overview", exact: true },
  { to: "/app/admin/orgs", label: "Organizations" },
  { to: "/app/admin/users", label: "Users" },
];

function AdminLayout() {
  const { isAdmin, checking } = useIsAdmin();
  const { pathname } = useLocation();

  if (checking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/app/dashboard" />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-10">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Platform Admin</p>
        <h1 className="mt-1 font-serif text-2xl font-semibold text-foreground lg:text-3xl">
          System administration
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cross-organization oversight for LexGuild platform admins.
        </p>
      </div>

      <nav className="mt-6 flex gap-1 border-b border-border">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
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

      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
