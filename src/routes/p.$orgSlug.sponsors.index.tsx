import { useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getPublicSponsors, type PublicSponsor } from "@/lib/sponsors-public.functions";
import { PublicSponsorShell } from "@/components/website/PublicSponsorShell";

export const Route = createFileRoute("/p/$orgSlug/sponsors/")({
  loader: async ({ params }) => {
    try {
      return await getPublicSponsors({ data: { orgSlug: params.orgSlug } });
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Sponsors" }, { name: "robots", content: "noindex" }] };
    const title = `${loaderData.organization.name} Sponsors`;
    const description = `Businesses and legal service providers supporting ${loaderData.organization.name}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <h1 className="text-3xl font-semibold">Sponsors not found</h1>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <h1 className="text-3xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
  component: PublicSponsorsPage,
});

function PublicSponsorsPage() {
  const { organization, brand, sponsors, navPages } = Route.useLoaderData();
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
    <PublicSponsorShell organization={organization} brand={brand} navPages={navPages}>
      <h1 className="text-3xl font-semibold tracking-tight">Support the sponsors who support {organization.name}</h1>
      <p className="mt-2 text-muted-foreground">
        These partners help make our programs possible.
      </p>

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
                  <Link
                    key={s.id}
                    to="/p/$orgSlug/sponsors/$sponsorId"
                    params={{ orgSlug: organization.slug, sponsorId: s.id }}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/50"
                  >
                    <div className="flex h-16 items-center">
                      {s.logo_url ? (
                        <img src={s.logo_url} alt={`${s.name} logo`} loading="lazy" className="max-h-16 max-w-[70%] object-contain" />
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
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </PublicSponsorShell>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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
