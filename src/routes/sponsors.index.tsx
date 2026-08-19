import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { resolveSiteHostOrg } from "@/lib/website-domains.functions";

// Host-aware alias: on a verified site-mode custom domain, /sponsors serves
// that tenant's public sponsor directory. On lexguild.com it does not exist.
export const Route = createFileRoute("/sponsors/")({
  beforeLoad: async () => {
    let orgSlug: string | null = null;
    try {
      ({ orgSlug } = await resolveSiteHostOrg());
    } catch {
      /* fall through to not found */
    }
    if (!orgSlug) throw notFound();
    throw redirect({ to: "/p/$orgSlug/sponsors", params: { orgSlug } });
  },
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
    </div>
  ),
  component: () => null,
});
