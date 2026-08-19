import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { resolveSiteHostOrg } from "@/lib/website-domains.functions";

// Host-aware alias for the public sponsor detail page on site-mode domains.
export const Route = createFileRoute("/sponsors/$sponsorId")({
  beforeLoad: async ({ params }) => {
    let orgSlug: string | null = null;
    try {
      ({ orgSlug } = await resolveSiteHostOrg());
    } catch {
      /* fall through to not found */
    }
    if (!orgSlug) throw notFound();
    throw redirect({
      to: "/p/$orgSlug/sponsors/$sponsorId",
      params: { orgSlug, sponsorId: params.sponsorId },
    });
  },
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
    </div>
  ),
  component: () => null,
});
