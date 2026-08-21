import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublicSponsors } from "@/lib/sponsors-public.functions";
import { SponsorsDirectory } from "@/components/website/SponsorsDirectory";
import { sponsorDirectoryMeta } from "@/components/website/SponsorDetailView";

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
    return sponsorDirectoryMeta(loaderData.organization.name);
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
  const { organization, brand, sponsors, navPages, hasEvents } = Route.useLoaderData();
  const { orgSlug } = Route.useParams();
  return (
    <SponsorsDirectory
      organization={organization}
      brand={brand}
      sponsors={sponsors}
      navPages={navPages}
      hasEvents={hasEvents}
      basePath={`/p/${orgSlug}`}
    />
  );
}
