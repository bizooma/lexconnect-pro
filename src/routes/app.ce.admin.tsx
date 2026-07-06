import { createFileRoute, Link, Navigate, Outlet, useLocation } from "@tanstack/react-router";
import { useCurrentOrg } from "@/hooks/use-current-org";

export const Route = createFileRoute("/app/ce/admin")({
  component: CeAdminLayout,
});

function CeAdminLayout() {
  const { pathname } = useLocation();
  const { isOrgAdmin, loading } = useCurrentOrg();
  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!isOrgAdmin) return <Navigate to="/app/ce" />;

  const tabs = [
    { to: "/app/ce/admin", label: "Courses", exact: true },
    { to: "/app/ce/admin/assignments", label: "Assignments" },
    { to: "/app/ce/admin/results", label: "Results" },
  ];

  return (
    <div>
      <nav className="mb-6 flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to || pathname === t.to + "/" : pathname.startsWith(t.to);
          return (
            <Link key={t.to} to={t.to}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
