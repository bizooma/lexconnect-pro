import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublicEventsPage } from "@/lib/events-public.functions";
import { PublicEventsView, publicEventsMeta } from "@/components/events/PublicEventsView";

export const Route = createFileRoute("/p/$orgSlug/events/")({
  loader: async ({ params }) => {
    try {
      return await getPublicEventsPage({ data: { orgSlug: params.orgSlug } });
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Events" }, { name: "robots", content: "noindex" }] };
    return publicEventsMeta(loaderData.organization.name);
  },
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
    </div>
  ),
  component: PublicEventsPage,
});

function PublicEventsPage() {
  const data = Route.useLoaderData();
  const { orgSlug } = Route.useParams();
  return (
    <PublicEventsView
      organization={data.organization}
      brand={data.brand}
      navPages={data.navPages}
      hasSponsors={data.hasSponsors}
      events={data.events}
      basePath={`/p/${orgSlug}`}
    />
  );
}
