import { createFileRoute, notFound } from "@tanstack/react-router";
import { resolveSiteHostOrg } from "@/lib/website-domains.functions";
import { getPublicEventsPage } from "@/lib/events-public.functions";
import { PublicEventsView, publicEventsMeta } from "@/components/events/PublicEventsView";

// Clean-path public events index for verified site-mode custom domains.
export const Route = createFileRoute("/events/")({
  loader: async () => {
    let orgSlug: string | null = null;
    try {
      ({ orgSlug } = await resolveSiteHostOrg());
    } catch {
      throw notFound();
    }
    if (!orgSlug) throw notFound();
    try {
      return await getPublicEventsPage({ data: { orgSlug } });
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
  component: HostEventsPage,
});

function HostEventsPage() {
  const data = Route.useLoaderData();
  return (
    <PublicEventsView
      organization={data.organization}
      brand={data.brand}
      navPages={data.navPages}
      hasSponsors={data.hasSponsors}
      events={data.events}
      basePath=""
    />
  );
}
