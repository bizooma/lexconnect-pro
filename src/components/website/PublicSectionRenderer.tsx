import type { WebsiteSectionType } from "@/lib/website";

type SectionLike = {
  id: string;
  section_type: WebsiteSectionType | string;
  content_json: unknown;
  settings_json?: unknown;
};

type Brand = {
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  heading_font?: string | null;
  body_font?: string | null;
  border_radius?: string | null;
  page_width?: string | null;
} | null;

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function brandStyle(brand: Brand): React.CSSProperties {
  const s: Record<string, string> = {};
  if (brand?.primary_color) s["--site-primary"] = brand.primary_color;
  if (brand?.secondary_color) s["--site-secondary"] = brand.secondary_color;
  if (brand?.accent_color) s["--site-accent"] = brand.accent_color;
  if (brand?.heading_font) s["--site-heading-font"] = brand.heading_font;
  if (brand?.body_font) s["--site-body-font"] = brand.body_font;
  if (brand?.border_radius) s["--site-radius"] = brand.border_radius;
  return s as React.CSSProperties;
}

export function PublicSectionRenderer({ section }: { section: SectionLike }) {
  const c = asRec(section.content_json);
  const headline = str(c.headline);
  const sub = str(c.subheadline);
  const body = str(c.body);
  const ctaLabel = str(c.cta_label);
  const ctaHref = str(c.cta_href) || "#";
  const image = str(c.image_url);

  switch (section.section_type) {
    case "hero":
      return (
        <section className="px-6 py-24 text-center" style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--site-primary, hsl(var(--primary))) 12%, transparent), color-mix(in oklab, var(--site-accent, hsl(var(--accent))) 12%, transparent))" }}>
          <div className="mx-auto max-w-4xl">
            {headline && (
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight" style={{ fontFamily: "var(--site-heading-font, inherit)" }}>
                {headline}
              </h1>
            )}
            {sub && <p className="mt-6 text-lg md:text-xl text-muted-foreground">{sub}</p>}
            {ctaLabel && (
              <a href={ctaHref} className="mt-8 inline-block rounded-lg px-6 py-3 text-sm font-medium text-white" style={{ background: "var(--site-primary, hsl(var(--primary)))", borderRadius: "var(--site-radius, 0.5rem)" }}>
                {ctaLabel}
              </a>
            )}
          </div>
        </section>
      );
    case "cta":
      return (
        <section className="px-6 py-16 text-center" style={{ background: "color-mix(in oklab, var(--site-primary, hsl(var(--primary))) 6%, transparent)" }}>
          <div className="mx-auto max-w-3xl">
            {headline && <h2 className="text-3xl font-semibold">{headline}</h2>}
            {sub && <p className="mt-3 text-muted-foreground">{sub}</p>}
            {ctaLabel && (
              <a href={ctaHref} className="mt-6 inline-block rounded-lg px-5 py-2.5 text-sm font-medium text-white" style={{ background: "var(--site-primary, hsl(var(--primary)))", borderRadius: "var(--site-radius, 0.5rem)" }}>
                {ctaLabel}
              </a>
            )}
          </div>
        </section>
      );
    case "text":
      return (
        <section className="px-6 py-12">
          <div className="mx-auto max-w-3xl">
            {headline && <h2 className="text-2xl font-semibold mb-4">{headline}</h2>}
            <div className="whitespace-pre-wrap text-base leading-relaxed text-foreground/90">{body}</div>
          </div>
        </section>
      );
    case "image_text":
      return (
        <section className="px-6 py-12">
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2 md:items-center">
            <div className="aspect-video rounded-lg bg-muted" style={image ? { backgroundImage: `url(${image})`, backgroundSize: "cover", backgroundPosition: "center", borderRadius: "var(--site-radius, 0.5rem)" } : undefined} />
            <div>
              {headline && <h2 className="text-2xl font-semibold">{headline}</h2>}
              {body && <p className="mt-3 whitespace-pre-wrap text-muted-foreground">{body}</p>}
              {ctaLabel && (
                <a href={ctaHref} className="mt-5 inline-block rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--site-primary, hsl(var(--primary)))", borderRadius: "var(--site-radius, 0.5rem)" }}>
                  {ctaLabel}
                </a>
              )}
            </div>
          </div>
        </section>
      );
    case "feature_grid": {
      const items = arr(c.items);
      return (
        <section className="px-6 py-16">
          <div className="mx-auto max-w-6xl">
            {headline && <h2 className="text-3xl font-semibold text-center mb-10">{headline}</h2>}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((it, i) => {
                const r = asRec(it);
                return (
                  <div key={i} className="rounded-lg border border-border bg-card p-6" style={{ borderRadius: "var(--site-radius, 0.5rem)" }}>
                    <h3 className="text-lg font-semibold">{str(r.title)}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{str(r.body)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      );
    }
    case "stats": {
      const items = arr(c.items);
      return (
        <section className="px-6 py-12">
          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 md:grid-cols-4 text-center">
            {items.map((it, i) => {
              const r = asRec(it);
              return (
                <div key={i}>
                  <div className="text-4xl font-bold" style={{ color: "var(--site-primary, hsl(var(--primary)))" }}>{str(r.value)}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{str(r.label)}</div>
                </div>
              );
            })}
          </div>
        </section>
      );
    }
    case "faq": {
      const items = arr(c.items);
      return (
        <section className="px-6 py-16">
          <div className="mx-auto max-w-3xl">
            {headline && <h2 className="text-3xl font-semibold mb-8">{headline}</h2>}
            <div className="space-y-4">
              {items.map((it, i) => {
                const r = asRec(it);
                return (
                  <details key={i} className="rounded-lg border border-border bg-card p-4" style={{ borderRadius: "var(--site-radius, 0.5rem)" }}>
                    <summary className="cursor-pointer font-medium">{str(r.question)}</summary>
                    <p className="mt-2 text-sm text-muted-foreground">{str(r.answer)}</p>
                  </details>
                );
              })}
            </div>
          </div>
        </section>
      );
    }
    case "testimonials": {
      const items = arr(c.items);
      return (
        <section className="px-6 py-16 bg-muted/30">
          <div className="mx-auto max-w-5xl grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.map((it, i) => {
              const r = asRec(it);
              return (
                <blockquote key={i} className="rounded-lg border border-border bg-card p-6" style={{ borderRadius: "var(--site-radius, 0.5rem)" }}>
                  <p className="text-sm italic">"{str(r.quote)}"</p>
                  <footer className="mt-4 text-xs font-medium">— {str(r.author)}{r.role ? `, ${str(r.role)}` : ""}</footer>
                </blockquote>
              );
            })}
          </div>
        </section>
      );
    }
    case "video": {
      const url = str(c.video_url);
      return (
        <section className="px-6 py-12">
          <div className="mx-auto max-w-4xl aspect-video">
            {url ? (
              <iframe src={url} className="h-full w-full rounded-lg" title={headline || "Video"} allowFullScreen style={{ borderRadius: "var(--site-radius, 0.5rem)" }} />
            ) : (
              <div className="h-full w-full rounded-lg bg-muted" />
            )}
          </div>
        </section>
      );
    }
    case "newsletter":
      return (
        <section className="px-6 py-16 text-center">
          <div className="mx-auto max-w-2xl">
            {headline && <h2 className="text-2xl font-semibold">{headline}</h2>}
            {sub && <p className="mt-2 text-muted-foreground">{sub}</p>}
            <form className="mt-6 flex gap-2 justify-center" onSubmit={(e) => e.preventDefault()}>
              <input type="email" required placeholder="you@example.com" className="rounded-lg border border-border bg-background px-4 py-2 text-sm w-72" style={{ borderRadius: "var(--site-radius, 0.5rem)" }} />
              <button type="submit" className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--site-primary, hsl(var(--primary)))", borderRadius: "var(--site-radius, 0.5rem)" }}>
                Subscribe
              </button>
            </form>
          </div>
        </section>
      );
    case "contact_form":
      return (
        <section className="px-6 py-16">
          <div className="mx-auto max-w-xl">
            {headline && <h2 className="text-2xl font-semibold text-center mb-6">{headline}</h2>}
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <input required placeholder="Your name" className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm" style={{ borderRadius: "var(--site-radius, 0.5rem)" }} />
              <input required type="email" placeholder="Email" className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm" style={{ borderRadius: "var(--site-radius, 0.5rem)" }} />
              <textarea required rows={5} placeholder="Message" className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm" style={{ borderRadius: "var(--site-radius, 0.5rem)" }} />
              <button type="submit" className="w-full rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--site-primary, hsl(var(--primary)))", borderRadius: "var(--site-radius, 0.5rem)" }}>
                Send message
              </button>
            </form>
          </div>
        </section>
      );
    case "custom_html": {
      const html = str(c.html);
      return (
        <section className="px-6 py-12">
          <div className="mx-auto max-w-5xl prose prose-neutral dark:prose-invert" dangerouslySetInnerHTML={{ __html: html }} />
        </section>
      );
    }
    default:
      return (
        <section className="px-6 py-12">
          <div className="mx-auto max-w-3xl">
            {headline && <h2 className="text-2xl font-semibold">{headline}</h2>}
            {body && <p className="mt-3 text-muted-foreground whitespace-pre-wrap">{body}</p>}
          </div>
        </section>
      );
  }
}
