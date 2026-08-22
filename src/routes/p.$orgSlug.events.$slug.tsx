import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublicEventPage } from "@/lib/events-public.functions";
import { PublicEventDetailPage, publicEventMeta } from "@/components/events/PublicEventDetailView";

export const Route = createFileRoute("/p/$orgSlug/events/$slug")({
  loader: async ({ params }) => {
    try {
      return await getPublicEventPage({ data: { orgSlug: params.orgSlug, slug: params.slug } });
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
  component: PublicEventDetail,
});

function PublicEventDetail() {
  const data = Route.useLoaderData();
  const { orgSlug } = Route.useParams();
  return (
    <PublicEventDetailPage
      organization={data.organization}
      brand={data.brand}
      navPages={data.navPages}
      hasSponsors={data.hasSponsors}
      hasReferralService={data.hasReferralService}
      event={data.event}
      basePath={`/p/${orgSlug}`}
    />
  );
}
