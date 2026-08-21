import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { seedRiverbendMembers } from "@/lib/demo-seed.functions";


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

  const [seeding, setSeeding] = useState(false);

  async function runSeed() {
    setSeeding(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await seedRiverbendMembers({
        data: { accessToken: sess.session?.access_token ?? "" },
      });
      if (!res.ok) {
        toast.error(res.error ?? "Seed failed");
      } else {
        toast.success(
          `Seeded ${res.membersCreated} new members (${res.membersSkipped} existing), ${res.mentorships} mentorships, ${res.participants} participants, ${res.checkins} check-ins, ${res.preferences} focus areas.`,
        );
      }
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="space-y-6">
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

      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <p className="font-medium text-foreground">Riverbend demo seed</p>
        <p className="mt-1 text-sm text-muted-foreground">
          One-time, idempotent seed of 12 demo member accounts, mentorships, challenge activity and
          wellness focus areas. Shared demo password: RiverbendDemo!2026
        </p>
        <Button className="mt-3" onClick={runSeed} disabled={seeding}>
          {seeding ? "Seeding…" : "Run demo seed"}
        </Button>
      </div>
    </div>
  );

}
