import { useState } from "react";

export type PublicNavPage = { id: string; title: string; slug: string };

/**
 * Slim navigation header for public tenant sites.
 * Renders nothing when the org has no nav links — single campaign pages
 * keep the minimal look.
 */
export function PublicSiteHeader({
  organization,
  navPages,
  hasSponsors,
  maxWidth,
  currentSlug,
}: {
  organization: { name: string; slug: string; logo_url: string | null };
  navPages: PublicNavPage[];
  hasSponsors: boolean;
  maxWidth: string;
  currentSlug?: string;
}) {
  const [open, setOpen] = useState(false);

  const links: Array<{ key: string; label: string; href: string; active: boolean }> = navPages.map((p) => ({
    key: p.id,
    label: p.title,
    href: `/p/${organization.slug}/${p.slug}`,
    active: p.slug === currentSlug,
  }));
  if (hasSponsors) {
    links.push({
      key: "sponsors",
      label: "Sponsors",
      href: `/p/${organization.slug}/sponsors`,
      active: currentSlug === "sponsors",
    });
  }

  if (links.length === 0) return null;

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex items-center justify-between gap-4 px-6 py-4" style={{ maxWidth }}>
        <a href={`/p/${organization.slug}/home`} className="flex items-center gap-2">
          {organization.logo_url ? (
            <img src={organization.logo_url} alt={organization.name} className="h-8 w-auto" />
          ) : null}
          <span className="text-lg font-semibold">{organization.name}</span>
        </a>

        <nav className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <a
              key={l.key}
              href={l.href}
              aria-current={l.active ? "page" : undefined}
              className={
                l.active
                  ? "text-sm font-medium text-foreground"
                  : "text-sm text-muted-foreground hover:text-foreground"
              }
            >
              {l.label}
            </a>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle navigation menu"
          className="rounded border border-border px-3 py-1.5 text-sm text-foreground md:hidden"
        >
          Menu
        </button>
      </div>

      {open && (
        <div className="border-t border-border md:hidden">
          <nav className="mx-auto flex flex-col px-6 py-2" style={{ maxWidth }}>
            {links.map((l) => (
              <a
                key={l.key}
                href={l.href}
                className="py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
