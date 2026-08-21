import type { ReactNode } from "react";
import { brandStyle } from "@/components/website/PublicSectionRenderer";
import { PublicSiteHeader, type PublicNavPage } from "@/components/website/PublicSiteHeader";
import { useSiteBase, siteHref, homeHref } from "@/components/website/site-base";

export function PublicSponsorShell({
  organization,
  brand,
  children,
  navPages = [],
  hasSponsors = true,
  hasEvents = false,
  currentSlug = "sponsors",
}: {
  organization: { name: string; slug: string; logo_url: string | null };
  brand: any | null;
  children: ReactNode;
  navPages?: PublicNavPage[];
  hasSponsors?: boolean;
  hasEvents?: boolean;
  currentSlug?: string;
}) {
  const base = useSiteBase();
  const maxWidth = brand?.page_width || "1200px";
  const fontImports: string[] = [];
  if (brand?.heading_font) fontImports.push(brand.heading_font);
  if (brand?.body_font && brand.body_font !== brand.heading_font) fontImports.push(brand.body_font);
  const fontHref = fontImports.length
    ? `https://fonts.googleapis.com/css2?${fontImports
        .map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`)
        .join("&")}&display=swap`
    : null;

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{
        ...brandStyle(brand),
        fontFamily: brand?.body_font ? `${brand.body_font}, system-ui, sans-serif` : undefined,
      }}
    >
      {fontHref && <link rel="stylesheet" href={fontHref} />}
      {navPages.length > 0 || hasEvents ? (
        <PublicSiteHeader
          organization={organization}
          navPages={navPages}
          hasSponsors={hasSponsors}
          hasEvents={hasEvents}
          maxWidth={maxWidth}
          currentSlug={currentSlug}
        />
      ) : (
        <header className="border-b border-border">
          <div className="mx-auto flex items-center justify-between px-6 py-4" style={{ maxWidth }}>
            <a href={homeHref(base)} className="flex items-center gap-2">
              {organization.logo_url ? (
                <img src={organization.logo_url} alt={organization.name} className="h-8 w-auto" />
              ) : (
                <span className="text-lg font-semibold">{organization.name}</span>
              )}
            </a>
            <a href={siteHref(base, "/sponsors")} className="text-sm text-muted-foreground hover:text-foreground">
              Sponsors
            </a>
          </div>
        </header>
      )}
      <main className="mx-auto px-6 py-12" style={{ maxWidth }}>
        {children}
      </main>
      <footer className="mt-16 border-t border-border">
        <div className="mx-auto px-6 py-8 text-sm text-muted-foreground" style={{ maxWidth }}>
          {brand?.footer_text || `© ${new Date().getFullYear()} ${organization.name}`}
        </div>
      </footer>
    </div>
  );
}

export function sponsorEmbedUrl(provider: string | null, id: string | null): string | null {
  if (!id || !/^[A-Za-z0-9_-]{1,40}$/.test(id)) return null;
  if (provider === "youtube") return `https://www.youtube-nocookie.com/embed/${id}`;
  if (provider === "vimeo") return `https://player.vimeo.com/video/${id}`;
  return null;
}
