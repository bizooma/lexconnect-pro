import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublicSponsors } from "@/lib/sponsors-public.functions";
import { SponsorDetailView, sponsorDetailMeta } from "@/components/website/SponsorDetailView";

export const Route = createFileRoute("/p/$orgSlug/sponsors/$sponsorId")({
  loader: async ({ params }) => {
    let payload;
    try {
      payload = await getPublicSponsors({ data: { orgSlug: params.orgSlug } });
    } catch {
      throw notFound();
    }
    const sponsor = payload.sponsors.find((s) => s.id === params.sponsorId);
    if (!sponsor) throw notFound();
    return { organization: payload.organization, brand: payload.brand, sponsor, navPages: payload.navPages };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Sponsor" }, { name: "robots", content: "noindex" }] };
    return sponsorDetailMeta(loaderData.organization.name, loaderData.sponsor);
  },
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <h1 className="text-3xl font-semibold">Sponsor not found</h1>
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
  component: PublicSponsorDetail,
});

function PublicSponsorDetail() {
  const { organization, brand, sponsor, navPages } = Route.useLoaderData();
  const { orgSlug } = Route.useParams();
  return (
    <SponsorDetailView
      organization={organization}
      brand={brand}
      sponsor={sponsor}
      navPages={navPages}
      basePath={`/p/${orgSlug}`}
    />
  );
}
