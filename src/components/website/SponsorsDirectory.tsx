import { useMemo, useState } from "react";
import type { PublicSponsor } from "@/lib/sponsors-public.functions";
import { PublicSponsorShell } from "@/components/website/PublicSponsorShell";
import { SiteBaseProvider, siteHref } from "@/components/website/site-base";

export function SponsorsDirectory({
  organization,
  brand,
  sponsors,
  navPages,
  basePath,
  hasEvents = false,
  hasReferralService = false,
}: {
  organization: { id: string; name: string; slug: string; logo_url: string | null };
  brand: any | null;
  sponsors: PublicSponsor[];
  navPages: Array<{ id: string; title: string; slug: string; nav_order: number }>;
  basePath: string;
  hasEvents?: boolean;
  hasReferralService?: boolean;
}) {
  const [category, setCategory] = useState("all");

  const categories = useMemo(
    () => Array.from(new Set(sponsors.map((s) => s.category).filter((c): c is string => !!c))).sort(),
    [sponsors],
  );

  const filtered = sponsors.filter((s) => category === "all" || s.category === category);

  const groups = useMemo(() => {
    const map = new Map<string, PublicSponsor[]>();
    for (const s of filtered) {
      const list = map.get(s.tier) ?? [];
      list.push(s);
      map.set(s.tier, list);
    }
    return Array.from(map.entries()).sort((a, b) => (a[1][0]?.tier_rank ?? 0) - (b[1][0]?.tier_rank ?? 0));
  }, [filtered]);

  return (
    <SiteBaseProvider basePath={basePath}>
      <PublicSponsorShell organization={organization} brand={brand} navPages={navPages} hasEvents={hasEvents} hasReferralService={hasReferralService}>
        <h1 className="text-3xl font-semibold tracking-tight">
          Support the sponsors who support {organization.name}
        </h1>
        <p className="mt-2 text-muted-foreground">These partners help make our programs possible.</p>

        {categories.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            <FilterChip active={category === "all"} onClick={() => setCategory("all")}>All</FilterChip>
            {categories.map((c) => (
              <FilterChip key={c} active={category === c} onClick={() => setCategory(c)}>
                {c}
              </FilterChip>
            ))}
          </div>
        )}

        {groups.length === 0 ? (
          <p className="mt-10 text-muted-foreground">No sponsors listed yet.</p>
        ) : (
          <div className="mt-10 space-y-10">
            {groups.map(([tier, list]) => (
              <section key={tier} className="space-y-4">
                <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{tier}</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((s) => (
                    <a
                      key={s.id}
                      href={siteHref(basePath, `/sponsors/${s.id}`)}
                      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/50"
                    >
                      <div className="flex h-16 items-center">
                        {s.logo_url ? (
                          <img
                            src={s.logo_url}
                            alt={`${s.name} logo`}
                            loading="lazy"
                            className="max-h-16 max-w-[70%] object-contain"
                          />
                        ) : (
                          <span className="text-lg font-semibold">{s.name}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium leading-tight">{s.name}</p>
                        {s.category && <p className="text-xs text-muted-foreground">{s.category}</p>}
                      </div>
                      {s.offer && (
                        <span className="w-fit rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          Special offer
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </PublicSponsorShell>
    </SiteBaseProvider>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
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
