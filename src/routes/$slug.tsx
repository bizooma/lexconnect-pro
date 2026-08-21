import { createFileRoute, notFound } from "@tanstack/react-router";
import { getHostPage } from "@/lib/website-public.functions";
import { PublicPageView, publicPageMeta } from "@/components/website/PublicPageView";

/**
 * Clean-path page route for verified site-mode custom domains:
 * demobar.org/<slug> renders the published page in place.
 * On reserved hosts (lexguild.com, previews) this 404s.
 */
export const Route = createFileRoute("/$slug")({
  loader: async ({ params }) => {
    let res: Awaited<ReturnType<typeof getHostPage>>;
    try {
      res = await getHostPage({ data: { slug: params.slug } });
    } catch {
      throw notFound();
    }
    if (!res.page) throw notFound();
    return res.page;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Page not found" }, { name: "robots", content: "noindex" }] };
    return publicPageMeta(loaderData);
  },
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center px-6 text-center">
      <div>
        <h1 className="text-3xl font-semibold">Page not found</h1>
        <p className="mt-2 text-muted-foreground">The page you're looking for doesn't exist or hasn't been published.</p>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center px-6 text-center">
      <div>
        <h1 className="text-3xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
  component: HostPage,
});

function HostPage() {
  const data = Route.useLoaderData();
  return <PublicPageView data={data} basePath="" />;
}
