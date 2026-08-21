import { useEffect } from "react";
import { trackPageView } from "@/lib/website-analytics.functions";
import { PublicSectionRenderer, brandStyle } from "@/components/website/PublicSectionRenderer";
import { PublicSiteHeader } from "@/components/website/PublicSiteHeader";
import { SiteBaseProvider } from "@/components/website/site-base";

export type PublicPagePayload = {
  organization: { id: string; name: string; slug: string; logo_url: string | null };
  page: any;
  sections: Array<{ id: string }>;
  brand: any | null;
  navPages: Array<{ id: string; title: string; slug: string; nav_order: number }>;
  hasSponsors: boolean;
};

/**
 * Renders a published tenant page. `basePath` is "" on a verified custom
 * domain (clean URLs) and "/p/<orgSlug>" on lexguild.com / preview hosts.
 */
export function PublicPageView({
  data,
  basePath,
}: {
  data: PublicPagePayload;
  basePath: string;
}) {
  const { page, sections, brand, organization, navPages, hasSponsors } = data;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `wpv:${page.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    trackPageView({
      data: {
        organizationId: organization.id,
        pageId: page.id,
        referrer: document.referrer || null,
        userAgent: navigator.userAgent.slice(0, 500),
        visitorHash: null,
      },
    }).catch(() => {});
  }, [page.id, organization.id]);

  const fontImports: string[] = [];
  if (brand?.heading_font) fontImports.push(brand.heading_font);
  if (brand?.body_font && brand.body_font !== brand.heading_font) fontImports.push(brand.body_font);
  const fontHref = fontImports.length
    ? `https://fonts.googleapis.com/css2?${fontImports.map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`).join("&")}&display=swap`
    : null;

  const maxWidth = brand?.page_width || "1200px";

  return (
    <SiteBaseProvider basePath={basePath}>
      <div
        className="min-h-screen bg-background text-foreground"
        style={{
          ...brandStyle(brand),
          fontFamily: brand?.body_font ? `${brand.body_font}, system-ui, sans-serif` : undefined,
        }}
      >
        {fontHref && <link rel="stylesheet" href={fontHref} />}
        <PublicSiteHeader
          organization={organization}
          navPages={navPages}
          hasSponsors={hasSponsors}
          maxWidth={maxWidth}
          currentSlug={page.slug}
        />

        <main style={{ maxWidth, margin: "0 auto" }}>
          {sections.length === 0 ? (
            <section className="px-6 py-24 text-center">
              <h1 className="text-3xl font-semibold">{page.title}</h1>
            </section>
          ) : (
            sections.map((s) => (
              <PublicSectionRenderer
                key={s.id}
                section={s as never}
                context={{ organizationId: organization.id, pageId: page.id }}
              />
            ))
          )}
        </main>
        <footer className="border-t border-border mt-16">
          <div className="mx-auto px-6 py-8 text-sm text-muted-foreground" style={{ maxWidth }}>
            {brand?.footer_text || `© ${new Date().getFullYear()} ${organization.name}`}
          </div>
        </footer>
      </div>
    </SiteBaseProvider>
  );
}

export function publicPageMeta(data: PublicPagePayload) {
  const { page, organization, brand } = data;
  const suffix = brand?.seo_title_suffix ? ` ${brand.seo_title_suffix}` : ` — ${organization.name}`;
  const title = (page.meta_title || page.title) + suffix;
  const description = page.meta_description || "";
  const ogTitle = page.og_title || page.meta_title || page.title;
  const ogDescription = page.og_description || description;
  const ogImage = page.og_image as string | null;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: ogTitle },
      { property: "og:description", content: ogDescription },
      ...(ogImage ? [{ property: "og:image", content: ogImage }, { name: "twitter:image", content: ogImage }] : []),
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  };
}
