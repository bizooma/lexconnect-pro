import { createFileRoute, notFound } from "@tanstack/react-router";
import { resolveSiteHostOrg } from "@/lib/website-domains.functions";
import { getPublicSponsors } from "@/lib/sponsors-public.functions";
import { SponsorDetailView, sponsorDetailMeta } from "@/components/website/SponsorDetailView";

// Clean-path sponsor detail page for verified site-mode custom domains.
export const Route = createFileRoute("/sponsors/$sponsorId")({
  loader: async ({ params }) => {
    let orgSlug: string | null = null;
    try {
      ({ orgSlug } = await resolveSiteHostOrg());
    } catch {
      throw notFound();
    }
    if (!orgSlug) throw notFound();
    let payload;
    try {
      payload = await getPublicSponsors({ data: { orgSlug } });
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
      <h1 className="text-3xl font-semibold">Page not found</h1>
    </div>
  ),
  component: HostSponsorDetail,
});

function HostSponsorDetail() {
  const { organization, brand, sponsor, navPages } = Route.useLoaderData();
  return (
    <SponsorDetailView
      organization={organization}
      brand={brand}
      sponsor={sponsor}
      navPages={navPages}
      basePath=""
    />
  );
}
