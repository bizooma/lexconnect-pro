import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublicReferralIntakePage } from "@/lib/lrs-public.functions";
import { PublicIntakeView, publicIntakeMeta } from "@/components/lrs/PublicIntakeView";

export const Route = createFileRoute("/p/$orgSlug/find-a-lawyer")({
  loader: async ({ params }) => {
    try {
      return await getPublicReferralIntakePage({ data: { orgSlug: params.orgSlug } });
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData)
      return { meta: [{ title: "Find a Lawyer" }, { name: "robots", content: "noindex" }] };
    return publicIntakeMeta(loaderData.organization.name);
  },
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
    </div>
  ),
  component: PublicIntakePage,
});

function PublicIntakePage() {
  const data = Route.useLoaderData();
  const { orgSlug } = Route.useParams();
  return (
    <PublicIntakeView
      organization={data.organization}
      brand={data.brand}
      navPages={data.navPages}
      hasSponsors={data.hasSponsors}
      hasEvents={data.hasEvents}
      paused={data.paused}
      customDisclaimer={data.customDisclaimer}
      basePath={`/p/${orgSlug}`}
    />
  );
}
