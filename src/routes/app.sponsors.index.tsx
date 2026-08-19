import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";

export const Route = createFileRoute("/app/sponsors/")({
  head: () => ({
    meta: [
      { title: "Sponsors — LexGuild" },
      {
        name: "description",
        content: "Local businesses and legal service providers supporting your organization, plus member-only offers.",
      },
      { property: "og:title", content: "Sponsors — LexGuild" },
      {
        property: "og:description",
        content: "Browse the sponsors supporting your organization and the offers available to members.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SponsorsPage,
});

export type MemberSponsor = {
  id: string;
  name: string;
  tier: string;
  tier_rank: number;
  category: string | null;
  blurb: string | null;
  offer: string | null;
  logo_url: string | null;
  display_order: number;
};

function SponsorsPage() {
  const { currentOrg } = useCurrentOrg();
  const [sponsors, setSponsors] = useState<MemberSponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("all");
  const [tier, setTier] = useState<string>("all");

  useEffect(() => {
    if (!currentOrg?.id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("org_sponsors")
        .select(
          "id, name, tier, tier_rank, category, blurb, offer, logo_url, display_order, org_sponsor_tiers(name, rank)",
        )
        .eq("organization_id", currentOrg.id)
        .eq("status", "active");
      if (cancelled) return;
      const rows = ((data ?? []) as any[]).map((s) => {
        const joined = s.org_sponsor_tiers as { name: string; rank: number } | null;
        return {
          id: s.id,
          name: s.name,
          tier: joined?.name ?? s.tier,
          tier_rank: joined?.rank ?? s.tier_rank,
          category: s.category,
          blurb: s.blurb,
          offer: s.offer,
          logo_url: s.logo_url,
          display_order: s.display_order,
        } as MemberSponsor;
      });
      rows.sort(
        (a, b) =>
          a.tier_rank - b.tier_rank ||
          a.display_order - b.display_order ||
          a.name.localeCompare(b.name),
      );
      setSponsors(rows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrg?.id]);


  const categories = useMemo(
    () => Array.from(new Set(sponsors.map((s) => s.category).filter((c): c is string => !!c))).sort(),
    [sponsors],
  );
  const tiers = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sponsors) if (!map.has(s.tier)) map.set(s.tier, s.tier_rank);
    return Array.from(map.entries()).sort((a, b) => a[1] - b[1]).map(([t]) => t);
  }, [sponsors]);

  const filtered = sponsors.filter(
    (s) => (category === "all" || s.category === category) && (tier === "all" || s.tier === tier),
  );

  const groups = useMemo(() => {
    const map = new Map<string, MemberSponsor[]>();
    for (const s of filtered) {
      const list = map.get(s.tier) ?? [];
      list.push(s);
      map.set(s.tier, list);
    }
    return Array.from(map.entries()).sort(
      (a, b) => (a[1][0]?.tier_rank ?? 0) - (b[1][0]?.tier_rank ?? 0),
    );
  }, [filtered]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Support the sponsors who support {currentOrg?.name ?? "our organization"}
        </h1>
        <p className="text-sm text-muted-foreground">
          These partners help fund member programs. Many offer benefits just for members.
        </p>
      </header>

      {(categories.length > 0 || tiers.length > 1) && (
        <div className="space-y-2">
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Chip active={category === "all"} onClick={() => setCategory("all")}>All categories</Chip>
              {categories.map((c) => (
                <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                  {c}
                </Chip>
              ))}
            </div>
          )}
          {tiers.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <Chip active={tier === "all"} onClick={() => setTier("all")}>All tiers</Chip>
              {tiers.map((t) => (
                <Chip key={t} active={tier === t} onClick={() => setTier(t)}>
                  {t}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading sponsors…</p>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No sponsors to show yet.
        </div>
      ) : (
        groups.map(([tierName, list]) => (
          <section key={tierName} className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{tierName}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((s) => (
                <Link
                  key={s.id}
                  to="/app/sponsors/$sponsorId"
                  params={{ sponsorId: s.id }}
                  className="flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/50"
                >
                  <div className="flex h-16 items-center">
                    {s.logo_url ? (
                      <img src={s.logo_url} alt={`${s.name} logo`} loading="lazy" className="max-h-16 max-w-[70%] object-contain" />
                    ) : (
                      <span className="text-lg font-semibold">{s.name}</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium leading-tight">{s.name}</p>
                    {s.category && <p className="text-xs text-muted-foreground">{s.category}</p>}
                  </div>
                  {s.offer && (
                    <span className="w-fit rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      Member offer
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}
