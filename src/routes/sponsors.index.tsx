import { createFileRoute, notFound } from "@tanstack/react-router";
import { resolveSiteHostOrg } from "@/lib/website-domains.functions";
import { getPublicSponsors } from "@/lib/sponsors-public.functions";
import { SponsorsDirectory } from "@/components/website/SponsorsDirectory";
import { sponsorDirectoryMeta } from "@/components/website/SponsorDetailView";

// Clean-path sponsor directory for verified site-mode custom domains.
// Rendered in place — no redirect to /p/<orgSlug>/sponsors.
export const Route = createFileRoute("/sponsors/")({
  loader: async () => {
    let orgSlug: string | null = null;
    try {
      ({ orgSlug } = await resolveSiteHostOrg());
    } catch {
      throw notFound();
    }
    if (!orgSlug) throw notFound();
    try {
      return await getPublicSponsors({ data: { orgSlug } });
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Sponsors" }, { name: "robots", content: "noindex" }] };
    return sponsorDirectoryMeta(loaderData.organization.name);
  },
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
    </div>
  ),
  component: HostSponsorsPage,
});

function HostSponsorsPage() {
  const { organization, brand, sponsors, navPages } = Route.useLoaderData();
  return (
    <SponsorsDirectory
      organization={organization}
      brand={brand}
      sponsors={sponsors}
      navPages={navPages}
      basePath=""
    />
  );
}
