import { createFileRoute, notFound } from "@tanstack/react-router";
import { resolveSiteHostOrg } from "@/lib/website-domains.functions";
import { getPublicEventPage } from "@/lib/events-public.functions";
import { PublicEventDetailPage, publicEventMeta } from "@/components/events/PublicEventDetailView";

// Clean-path public event detail for verified site-mode custom domains.
export const Route = createFileRoute("/events/$slug")({
  loader: async ({ params }) => {
    let orgSlug: string | null = null;
    try {
      ({ orgSlug } = await resolveSiteHostOrg());
    } catch {
      throw notFound();
    }
    if (!orgSlug) throw notFound();
    try {
      return await getPublicEventPage({ data: { orgSlug, slug: params.slug } });
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Event" }, { name: "robots", content: "noindex" }] };
    return publicEventMeta(loaderData.organization.name, loaderData.event);
  },
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <h1 className="text-3xl font-semibold">Event not found</h1>
    </div>
  ),
  component: HostEventDetail,
});

function HostEventDetail() {
  const data = Route.useLoaderData();
  return (
    <PublicEventDetailPage
      organization={data.organization}
      brand={data.brand}
      navPages={data.navPages}
      hasSponsors={data.hasSponsors}
      hasReferralService={data.hasReferralService}
      event={data.event}
      basePath=""
    />
  );
}
