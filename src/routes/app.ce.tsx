import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useCurrentOrg } from "@/hooks/use-current-org";

export const Route = createFileRoute("/app/ce")({
  component: CeLayout,
});

function CeLayout() {
  const { pathname } = useLocation();
  const { isOrgAdmin } = useCurrentOrg();

  const tabs = [
    { to: "/app/ce", label: "My Learning", exact: true },
    { to: "/app/ce/catalog", label: "Catalog" },
    ...(isOrgAdmin ? [{ to: "/app/ce/admin", label: "Admin" }] : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-10">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">CE Learning</p>
        <h1 className="mt-1 font-serif text-2xl font-semibold text-foreground lg:text-3xl">
          Continuing Education
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Watch course videos, take quizzes, and track your CE credit hours.
        </p>
      </div>

      <nav className="mt-6 flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to || pathname === t.to + "/" : pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
                active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
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
