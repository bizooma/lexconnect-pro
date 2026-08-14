import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getWebsitePage, getBrandSettings } from "@/lib/website.functions";
import { PublicSectionRenderer, brandStyle } from "@/components/website/PublicSectionRenderer";
import type { WebsitePage, WebsiteSection, WebsiteBrandSettings } from "@/lib/website";

export const Route = createFileRoute("/website-preview/$pageId")({
  head: () => ({
    meta: [
      { title: "Page preview — Website Builder" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Admin-only preview of an unpublished website page." },
    ],
  }),
  component: PagePreview,
});

function PagePreview() {
  const { pageId } = Route.useParams();
  const get = useServerFn(getWebsitePage);
  const getBrand = useServerFn(getBrandSettings);
  const [page, setPage] = useState<WebsitePage | null>(null);
  const [sections, setSections] = useState<WebsiteSection[]>([]);
  const [brand, setBrand] = useState<WebsiteBrandSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await get({ data: { pageId } });
        if (cancelled) return;
        const previewPage = res.page as unknown as WebsitePage;
        setPage(previewPage);
        setSections((res.sections ?? []) as unknown as WebsiteSection[]);
        const b = await getBrand({ data: { organizationId: previewPage.organization_id } });
        if (!cancelled) setBrand((b.brand as unknown as WebsiteBrandSettings) ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load preview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pageId, get, getBrand]);

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading preview…</div>;
  if (error || !page) return <div className="p-8 text-sm text-destructive">{error ?? "Page not found"}</div>;

  const maxWidth = brand?.page_width || "1200px";
  const fonts: string[] = [];
  if (brand?.heading_font) fonts.push(brand.heading_font);
  if (brand?.body_font && brand.body_font !== brand.heading_font) fonts.push(brand.body_font);
  const fontHref = fonts.length
    ? `https://fonts.googleapis.com/css2?${fonts.map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`).join("&")}&display=swap`
    : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-2 text-xs">
        <span className="text-muted-foreground">
          Preview — <span className="font-medium text-foreground">{page.title}</span> — this page is not published
        </span>
        <Link
          to="/app/website/pages/$pageId"
          params={{ pageId }}
          className="rounded-lg border border-border px-3 py-1.5 text-foreground hover:bg-accent"
        >
          Back to editor
        </Link>
      </div>
      <div
        style={{
          ...brandStyle(brand as never),
          fontFamily: brand?.body_font ? `${brand.body_font}, system-ui, sans-serif` : undefined,
        }}
      >
        {fontHref && <link rel="stylesheet" href={fontHref} />}
        <main style={{ maxWidth, margin: "0 auto" }}>
          {sections.length === 0 ? (
            <section className="px-6 py-24 text-center">
              <h1 className="text-3xl font-semibold text-foreground">{page.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">This page has no sections yet.</p>
            </section>
          ) : (
            sections
              .filter((s) => s.visible)
              .map((s) => <PublicSectionRenderer key={s.id} section={s as never} />)
          )}
        </main>
        <footer className="mt-16 border-t border-border">
          <div className="mx-auto px-6 py-8 text-sm text-muted-foreground" style={{ maxWidth }}>
            {brand?.footer_text || "Preview — not published"}
          </div>
        </footer>
      </div>
    </div>
  );
}
