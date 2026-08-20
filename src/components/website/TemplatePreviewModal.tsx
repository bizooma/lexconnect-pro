import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getBrandSettings } from "@/lib/website.functions";
import { PublicSectionRenderer, brandStyle } from "@/components/website/PublicSectionRenderer";
import { PAGE_TYPE_LABELS, type WebsitePageType, type WebsiteSectionType } from "@/lib/website";

type TemplateSection = {
  section_type: WebsiteSectionType | string;
  settings_json?: unknown;
  content_json?: unknown;
};

type Brand = {
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  heading_font?: string | null;
  body_font?: string | null;
  border_radius?: string | null;
  page_width?: string | null;
  logo_url?: string | null;
} | null;

export function TemplatePreviewModal({
  name,
  description,
  pageType,
  sections,
  organizationId,
  onUse,
  onClose,
  useLabel = "Use this template",
  busy = false,
}: {
  name: string;
  description?: string | null;
  pageType?: WebsitePageType;
  sections: unknown;
  organizationId?: string | null;
  onUse: () => void;
  onClose: () => void;
  useLabel?: string;
  busy?: boolean;
}) {
  const getBrand = useServerFn(getBrandSettings);
  const [brand, setBrand] = useState<Brand>(null);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    getBrand({ data: { organizationId } })
      .then((r) => {
        if (!cancelled) setBrand((r?.brand as Brand) ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [organizationId, getBrand]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const list = (Array.isArray(sections) ? sections : []) as TemplateSection[];
  const maxWidth = brand?.page_width || "1200px";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-0 sm:p-6">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-border bg-background shadow-2xl sm:rounded-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-card px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {brand?.logo_url && (
              <img src={brand.logo_url} alt="" className="h-8 w-8 shrink-0 rounded object-contain" />
            )}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground">
                {name}
                {pageType && (
                  <span className="ml-2 font-normal text-muted-foreground">{PAGE_TYPE_LABELS[pageType]}</span>
                )}
              </h2>
              <p className="truncate text-xs text-muted-foreground">
                {description || "Preview — this is how the finished page will look."}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onUse}
              disabled={busy}
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Working…" : useLabel}
            </button>
            <button
              onClick={onClose}
              aria-label="Close preview"
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground hover:bg-accent"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-background">
          <div
            className="select-none"
            style={{
              ...brandStyle(brand as never),
              pointerEvents: "none",
              fontFamily: brand?.body_font ? `${brand.body_font}, system-ui, sans-serif` : undefined,
            }}
            aria-hidden="true"
          >
            <main style={{ maxWidth, margin: "0 auto" }}>
              {list.length === 0 ? (
                <section className="px-6 py-24 text-center">
                  <h1 className="text-3xl font-semibold text-foreground">{name}</h1>
                  <p className="mt-2 text-sm text-muted-foreground">This template has no sections.</p>
                </section>
              ) : (
                list.map((s, i) => (
                  <PublicSectionRenderer
                    key={i}
                    section={{
                      id: `tpl-${i}`,
                      section_type: s.section_type,
                      content_json: s.content_json ?? {},
                      settings_json: s.settings_json ?? {},
                    }}
                  />
                ))
              )}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
