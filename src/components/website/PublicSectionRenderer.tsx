import { useMemo, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import type { WebsiteSectionType } from "@/lib/website";

export function sanitizeCustomHtml(input: string): string {
  if (!input) return "";
  return DOMPurify.sanitize(input, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button", "link", "meta", "base"],
    FORBID_ATTR: ["style", "srcdoc", "formaction", "xlink:href"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}

type SectionLike = {
  id: string;
  organization_id?: string;
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

const PRIMARY_BTN: React.CSSProperties = {
  background: "var(--site-primary, hsl(var(--primary)))",
  borderRadius: "var(--site-radius, 0.5rem)",
};
const RADIUS: React.CSSProperties = { borderRadius: "var(--site-radius, 0.5rem)" };

/**
 * Optional org/page context. When passed, contact_form and newsletter sections
 * actually submit to /api/public/website-form. Without context they render
 * disabled (preview mode).
 */
export type RendererContext = {
  organizationId?: string;
  pageId?: string;
  preview?: boolean;
};

export function PublicSectionRenderer({
  section,
  context,
}: {
  section: SectionLike;
  context?: RendererContext;
}) {
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
        <section
          className="px-6 py-24 text-center"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--site-primary, hsl(var(--primary))) 12%, transparent), color-mix(in oklab, var(--site-accent, hsl(var(--accent))) 12%, transparent))",
          }}
        >
          <div className="mx-auto max-w-4xl">
            {headline && (
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight" style={{ fontFamily: "var(--site-heading-font, inherit)" }}>
                {headline}
              </h1>
            )}
            {sub && <p className="mt-6 text-lg md:text-xl text-muted-foreground">{sub}</p>}
            {ctaLabel && (
              <a href={ctaHref} className="mt-8 inline-block rounded-lg px-6 py-3 text-sm font-medium text-white" style={PRIMARY_BTN}>
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
              <a href={ctaHref} className="mt-6 inline-block rounded-lg px-5 py-2.5 text-sm font-medium text-white" style={PRIMARY_BTN}>
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
            <div className="aspect-video bg-muted" style={image ? { ...RADIUS, backgroundImage: `url(${image})`, backgroundSize: "cover", backgroundPosition: "center" } : RADIUS} />
            <div>
              {headline && <h2 className="text-2xl font-semibold">{headline}</h2>}
              {body && <p className="mt-3 whitespace-pre-wrap text-muted-foreground">{body}</p>}
              {ctaLabel && (
                <a href={ctaHref} className="mt-5 inline-block rounded-lg px-4 py-2 text-sm font-medium text-white" style={PRIMARY_BTN}>
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
                  <div key={i} className="border border-border bg-card p-6" style={RADIUS}>
                    {str(r.icon) && <div className="text-2xl mb-2">{str(r.icon)}</div>}
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
                  <details key={i} className="border border-border bg-card p-4" style={RADIUS}>
                    <summary className="cursor-pointer font-medium">{str(r.question)}</summary>
                    <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{str(r.answer)}</p>
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
                <blockquote key={i} className="border border-border bg-card p-6" style={RADIUS}>
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
              <iframe src={url} className="h-full w-full" title={headline || "Video"} allowFullScreen style={RADIUS} />
            ) : (
              <div className="h-full w-full bg-muted" style={RADIUS} />
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
            <PublicForm
              kind="newsletter"
              context={context}
              section={section}
              fields={[{ name: "email", type: "email", placeholder: "you@example.com", required: true, className: "w-72" }]}
              submitLabel={str(c.cta_label) || "Subscribe"}
              successMessage={str(c.success_message) || "Thanks — you're on the list."}
              layout="row"
            />
          </div>
        </section>
      );
    case "contact_form":
      return (
        <section className="px-6 py-16">
          <div className="mx-auto max-w-xl">
            {headline && <h2 className="text-2xl font-semibold text-center mb-6">{headline}</h2>}
            <PublicForm
              kind="contact"
              context={context}
              section={section}
              fields={[
                { name: "name", placeholder: "Your name", required: true },
                { name: "email", type: "email", placeholder: "Email", required: true },
                { name: "message", placeholder: "Message", required: true, multiline: true, rows: 5 },
              ]}
              submitLabel={str(c.cta_label) || "Send message"}
              successMessage={str(c.success_message) || "Thanks — we'll be in touch."}
              layout="stack"
            />
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
    case "event_details": {
      const date = str(c.event_date);
      const location = str(c.location);
      const items = arr(c.agenda);
      return (
        <section className="px-6 py-16">
          <div className="mx-auto max-w-3xl">
            {headline && <h2 className="text-3xl font-semibold">{headline}</h2>}
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              {date && (
                <div className="border border-border bg-card p-4" style={RADIUS}>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Date & time</dt>
                  <dd className="mt-1 text-sm font-medium">{date}</dd>
                </div>
              )}
              {location && (
                <div className="border border-border bg-card p-4" style={RADIUS}>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Location</dt>
                  <dd className="mt-1 text-sm font-medium whitespace-pre-wrap">{location}</dd>
                </div>
              )}
            </dl>
            {body && <p className="mt-6 whitespace-pre-wrap text-muted-foreground">{body}</p>}
            {items.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Agenda</h3>
                <ul className="mt-3 space-y-3 border-l-2 border-border pl-4">
                  {items.map((it, i) => {
                    const r = asRec(it);
                    return (
                      <li key={i}>
                        <div className="text-sm font-medium">{str(r.time)}{str(r.time) && " · "}{str(r.title)}</div>
                        {str(r.description) && <div className="text-xs text-muted-foreground">{str(r.description)}</div>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {ctaLabel && (
              <a href={ctaHref} className="mt-8 inline-block rounded-lg px-5 py-2.5 text-sm font-medium text-white" style={PRIMARY_BTN}>
                {ctaLabel}
              </a>
            )}
          </div>
        </section>
      );
    }
    case "sponsor_grid": {
      const items = arr(c.items);
      return (
        <section className="px-6 py-16">
          <div className="mx-auto max-w-6xl">
            {headline && <h2 className="text-2xl font-semibold text-center mb-10">{headline}</h2>}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 items-center">
              {items.map((it, i) => {
                const r = asRec(it);
                const logo = str(r.logo_url);
                const href = str(r.href);
                const inner = logo ? (
                  <img src={logo} alt={str(r.name) || "Sponsor"} className="h-12 w-auto mx-auto opacity-80 hover:opacity-100 transition" />
                ) : (
                  <span className="text-sm text-muted-foreground">{str(r.name)}</span>
                );
                return (
                  <div key={i} className="flex items-center justify-center p-4">
                    {href ? <a href={href} target="_blank" rel="noreferrer">{inner}</a> : inner}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      );
    }
    case "speaker_cards":
    case "committee_cards":
    case "member_directory": {
      const items = arr(c.items);
      return (
        <section className="px-6 py-16">
          <div className="mx-auto max-w-6xl">
            {headline && <h2 className="text-2xl font-semibold text-center mb-10">{headline}</h2>}
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
              {items.map((it, i) => {
                const r = asRec(it);
                const photo = str(r.photo_url);
                return (
                  <div key={i} className="border border-border bg-card p-5 text-center" style={RADIUS}>
                    <div className="mx-auto h-24 w-24 overflow-hidden rounded-full bg-muted">
                      {photo && <img src={photo} alt={str(r.name)} className="h-full w-full object-cover" />}
                    </div>
                    <h3 className="mt-4 text-base font-semibold">{str(r.name)}</h3>
                    {str(r.role) && <p className="text-xs text-muted-foreground">{str(r.role)}</p>}
                    {str(r.bio) && <p className="mt-3 text-sm text-muted-foreground">{str(r.bio)}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      );
    }
    case "resource_cards": {
      const items = arr(c.items);
      return (
        <section className="px-6 py-16">
          <div className="mx-auto max-w-5xl">
            {headline && <h2 className="text-2xl font-semibold mb-8">{headline}</h2>}
            <div className="grid gap-4 sm:grid-cols-2">
              {items.map((it, i) => {
                const r = asRec(it);
                const href = str(r.href);
                const inner = (
                  <div className="border border-border bg-card p-5 hover:border-primary transition" style={RADIUS}>
                    <h3 className="text-base font-semibold">{str(r.title)}</h3>
                    {str(r.description) && <p className="mt-2 text-sm text-muted-foreground">{str(r.description)}</p>}
                    {str(r.kind) && <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">{str(r.kind)}</p>}
                  </div>
                );
                return href ? <a key={i} href={href}>{inner}</a> : <div key={i}>{inner}</div>;
              })}
            </div>
          </div>
        </section>
      );
    }
    case "pricing_tiers": {
      const items = arr(c.items);
      return (
        <section className="px-6 py-16">
          <div className="mx-auto max-w-5xl">
            {headline && <h2 className="text-3xl font-semibold text-center mb-10">{headline}</h2>}
            <div className="grid gap-6 md:grid-cols-3">
              {items.map((it, i) => {
                const r = asRec(it);
                const features = arr(r.features);
                const featured = !!r.featured;
                return (
                  <div
                    key={i}
                    className={`border bg-card p-6 ${featured ? "border-primary shadow-md" : "border-border"}`}
                    style={RADIUS}
                  >
                    <h3 className="text-lg font-semibold">{str(r.name)}</h3>
                    <p className="mt-3 text-3xl font-bold" style={{ color: "var(--site-primary, hsl(var(--primary)))" }}>
                      {str(r.price)}
                      {str(r.period) && <span className="text-sm font-normal text-muted-foreground"> /{str(r.period)}</span>}
                    </p>
                    {str(r.description) && <p className="mt-2 text-sm text-muted-foreground">{str(r.description)}</p>}
                    <ul className="mt-5 space-y-2 text-sm">
                      {features.map((f, j) => (
                        <li key={j} className="flex items-start gap-2"><span className="text-primary">✓</span> {String(f)}</li>
                      ))}
                    </ul>
                    {str(r.cta_label) && (
                      <a href={str(r.cta_href) || "#"} className="mt-6 inline-block w-full rounded-lg px-4 py-2 text-center text-sm font-medium text-white" style={PRIMARY_BTN}>
                        {str(r.cta_label)}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      );
    }
    case "timeline": {
      const items = arr(c.items);
      return (
        <section className="px-6 py-16">
          <div className="mx-auto max-w-3xl">
            {headline && <h2 className="text-3xl font-semibold mb-8">{headline}</h2>}
            <ol className="relative space-y-8 border-l-2 border-border pl-6">
              {items.map((it, i) => {
                const r = asRec(it);
                return (
                  <li key={i} className="relative">
                    <span
                      className="absolute -left-[33px] top-1 inline-block h-3 w-3 rounded-full ring-2 ring-background"
                      style={{ background: "var(--site-primary, hsl(var(--primary)))" }}
                    />
                    {str(r.date) && <div className="text-xs uppercase tracking-wider text-muted-foreground">{str(r.date)}</div>}
                    <div className="mt-1 text-base font-semibold">{str(r.title)}</div>
                    {str(r.description) && <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{str(r.description)}</p>}
                  </li>
                );
              })}
            </ol>
          </div>
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

// ---------------- Public form (real submit) ----------------

type FieldDef = {
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  className?: string;
};

function PublicForm({
  kind,
  fields,
  submitLabel,
  successMessage,
  layout,
  context,
  section,
}: {
  kind: "newsletter" | "contact";
  fields: FieldDef[];
  submitLabel: string;
  successMessage: string;
  layout: "row" | "stack";
  context?: RendererContext;
  section: SectionLike;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const disabled = !context?.organizationId || !!context?.preview;

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (disabled) return;
    setStatus("loading");
    setError(null);
    const fd = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    for (const [k, v] of fd.entries()) data[k] = String(v).slice(0, 4000);
    try {
      const res = await fetch("/api/public/website-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: context!.organizationId,
          pageId: context!.pageId ?? null,
          sectionId: section.id ?? null,
          formKind: kind,
          data,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error || `Submission failed (${res.status})`);
      }
      setStatus("ok");
      e.currentTarget.reset();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Submission failed");
    }
  };

  if (status === "ok") {
    return <p className="mt-6 text-sm text-muted-foreground">{successMessage}</p>;
  }

  const formClass = layout === "row" ? "mt-6 flex gap-2 justify-center flex-wrap" : "space-y-4";
  return (
    <form onSubmit={onSubmit} className={formClass}>
      {/* Honeypot */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {fields.map((f) => {
        const baseCls = `border border-border bg-background px-4 py-2 text-sm ${f.className ?? (layout === "stack" ? "w-full" : "")}`;
        return f.multiline ? (
          <textarea
            key={f.name}
            name={f.name}
            placeholder={f.placeholder}
            required={f.required}
            rows={f.rows ?? 4}
            className={baseCls}
            style={RADIUS}
          />
        ) : (
          <input
            key={f.name}
            name={f.name}
            type={f.type ?? "text"}
            placeholder={f.placeholder}
            required={f.required}
            className={baseCls}
            style={RADIUS}
          />
        );
      })}
      <button
        type="submit"
        disabled={disabled || status === "loading"}
        className={`${layout === "stack" ? "w-full" : ""} rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50`}
        style={PRIMARY_BTN}
      >
        {status === "loading" ? "Sending…" : submitLabel}
      </button>
      {disabled && (
        <p className="text-[11px] text-muted-foreground">Preview only — publish the page to enable submissions.</p>
      )}
      {status === "error" && error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </form>
  );
}
