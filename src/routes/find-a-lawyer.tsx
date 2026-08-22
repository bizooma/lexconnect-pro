import { createFileRoute, notFound } from "@tanstack/react-router";
import { resolveSiteHostOrg } from "@/lib/website-domains.functions";
import { getPublicReferralIntakePage } from "@/lib/lrs-public.functions";
import { PublicIntakeView, publicIntakeMeta } from "@/components/lrs/PublicIntakeView";

// Clean-path public referral intake for verified site-mode custom domains.
export const Route = createFileRoute("/find-a-lawyer")({
  loader: async () => {
    let orgSlug: string | null = null;
    try {
      ({ orgSlug } = await resolveSiteHostOrg());
    } catch {
      throw notFound();
    }
    if (!orgSlug) throw notFound();
    try {
      return await getPublicReferralIntakePage({ data: { orgSlug } });
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
  component: HostIntakePage,
});

function HostIntakePage() {
  const data = Route.useLoaderData();
  return (
    <PublicIntakeView
      organization={data.organization}
      brand={data.brand}
      navPages={data.navPages}
      hasSponsors={data.hasSponsors}
      hasEvents={data.hasEvents}
      paused={data.paused}
      customDisclaimer={data.customDisclaimer}
      basePath=""
    />
  );
}
