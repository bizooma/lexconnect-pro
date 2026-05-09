import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const [counts, setCounts] = useState<{
    orgs: number;
    profiles: number;
    activeSubs: number;
    mentorships: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const [orgs, profiles, subs, mentorships] = await Promise.all([
        supabase.from("organizations").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase
          .from("subscriptions")
          .select("id", { count: "exact", head: true })
          .in("status", ["active", "trialing", "grandfathered"]),
        supabase.from("mentorships").select("id", { count: "exact", head: true }),
      ]);
      setCounts({
        orgs: orgs.count ?? 0,
        profiles: profiles.count ?? 0,
        activeSubs: subs.count ?? 0,
        mentorships: mentorships.count ?? 0,
      });
    })();
  }, []);

  const stats = [
    { label: "Organizations", value: counts?.orgs, to: "/app/admin/orgs" },
    { label: "Users", value: counts?.profiles, to: "/app/admin/users" },
    { label: "Active subscriptions", value: counts?.activeSubs },
    { label: "Mentorships", value: counts?.mentorships },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => {
        const Inner = (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card transition hover:border-primary/40">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {s.label}
            </p>
            <p className="mt-2 font-serif text-3xl font-semibold text-foreground">
              {s.value ?? "—"}
            </p>
          </div>
        );
        return s.to ? (
          <Link key={s.label} to={s.to}>
            {Inner}
          </Link>
        ) : (
          <div key={s.label}>{Inner}</div>
        );
      })}
    </div>
  );
}
