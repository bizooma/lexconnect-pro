import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublicPage } from "@/lib/website-public.functions";
import { PublicSectionRenderer, brandStyle } from "@/components/website/PublicSectionRenderer";

export const Route = createFileRoute("/p/$orgSlug/$slug")({
  loader: async ({ params }) => {
    try {
      return await getPublicPage({ data: { orgSlug: params.orgSlug, slug: params.slug } });
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Page not found" }] };
    const { page, organization, brand } = loaderData;
    const suffix = brand?.seo_title_suffix ? ` ${brand.seo_title_suffix}` : ` — ${organization.name}`;
    const title = (page.meta_title || page.title) + suffix;
    const description = page.meta_description || "";
    const ogTitle = page.og_title || page.meta_title || page.title;
    const ogDescription = page.og_description || description;
    const ogImage = page.og_image;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: ogTitle },
        { property: "og:description", content: ogDescription },
        ...(ogImage ? [{ property: "og:image", content: ogImage }, { name: "twitter:image", content: ogImage }] : []),
        { property: "og:type", content: "website" },
      ],
    };
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
  component: PublicPage,
});

function PublicPage() {
  const { page, sections, brand, organization } = Route.useLoaderData();
  const fontImports: string[] = [];
  if (brand?.heading_font) fontImports.push(brand.heading_font);
  if (brand?.body_font && brand.body_font !== brand.heading_font) fontImports.push(brand.body_font);
  const fontHref = fontImports.length
    ? `https://fonts.googleapis.com/css2?${fontImports.map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`).join("&")}&display=swap`
    : null;

  const maxWidth = brand?.page_width || "1200px";

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{
        ...brandStyle(brand),
        fontFamily: brand?.body_font ? `${brand.body_font}, system-ui, sans-serif` : undefined,
      }}
    >
      {fontHref && <link rel="stylesheet" href={fontHref} />}
      <header className="border-b border-border">
        <div className="mx-auto flex items-center justify-between px-6 py-4" style={{ maxWidth }}>
          <a href={`/p/${organization.slug}`} className="flex items-center gap-2">
            {organization.logo_url ? (
              <img src={organization.logo_url} alt={organization.name} className="h-8 w-auto" />
            ) : (
              <span className="text-lg font-semibold">{organization.name}</span>
            )}
          </a>
        </div>
      </header>
      <main style={{ maxWidth, margin: "0 auto" }}>
        {sections.length === 0 ? (
          <section className="px-6 py-24 text-center">
            <h1 className="text-3xl font-semibold">{page.title}</h1>
          </section>
        ) : (
          sections.map((s: { id: string }) => <PublicSectionRenderer key={s.id} section={s as never} />)
        )}
      </main>
      <footer className="border-t border-border mt-16">
        <div className="mx-auto px-6 py-8 text-sm text-muted-foreground" style={{ maxWidth }}>
          {brand?.footer_text || `© ${new Date().getFullYear()} ${organization.name}`}
        </div>
      </footer>
    </div>
  );
}
