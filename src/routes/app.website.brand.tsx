import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { getBrandSettings, updateBrandSettings } from "@/lib/website.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/app/website/brand")({
  component: BrandPage,
});

type Brand = {
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  heading_font: string | null;
  body_font: string | null;
  button_style: string | null;
  page_width: string | null;
  border_radius: string | null;
  seo_title_suffix: string | null;
  footer_text: string | null;
};

const EMPTY: Brand = {
  logo_url: null, favicon_url: null,
  primary_color: null, secondary_color: null, accent_color: null,
  heading_font: null, body_font: null,
  button_style: null, page_width: null, border_radius: null,
  seo_title_suffix: null, footer_text: null,
};

const PRESETS = [
  { name: "Indigo Trust", primary: "#4f46e5", secondary: "#1e293b", accent: "#f59e0b" },
  { name: "Forest Counsel", primary: "#0f766e", secondary: "#1f2937", accent: "#eab308" },
  { name: "Burgundy Bar", primary: "#9f1239", secondary: "#1c1917", accent: "#d4a017" },
  { name: "Slate & Sky", primary: "#0284c7", secondary: "#0f172a", accent: "#22d3ee" },
];

const FONT_PAIRS = [
  { heading: "Inter", body: "Inter" },
  { heading: "Playfair Display", body: "Source Sans Pro" },
  { heading: "Cormorant Garamond", body: "Karla" },
  { heading: "Space Grotesk", body: "DM Sans" },
];

const RADIUS_OPTIONS = ["0", "0.25rem", "0.5rem", "0.75rem", "1rem"];

function BrandPage() {
  const { currentOrgId } = useCurrentOrg();
  const get = useServerFn(getBrandSettings);
  const upd = useServerFn(updateBrandSettings);
  const [brand, setBrand] = useState<Brand>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentOrgId) return;
    get({ data: { organizationId: currentOrgId } })
      .then((r) => setBrand({ ...EMPTY, ...(r.brand as Partial<Brand> | null ?? {}) }))
      .finally(() => setLoading(false));
  }, [currentOrgId, get]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrgId) return;
    setSaving(true);
    try {
      await upd({ data: { organizationId: currentOrgId, patch: brand } });
      toast.success("Brand settings saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof Brand>(k: K, v: Brand[K]) => setBrand((b) => ({ ...b, [k]: v }));

  const previewStyle = useMemo<React.CSSProperties>(() => ({
    backgroundColor: "#fff",
    color: brand.secondary_color ?? "#0f172a",
    borderRadius: brand.border_radius ?? "0.5rem",
    fontFamily: brand.body_font ?? "Inter, system-ui, sans-serif",
  }), [brand]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-6">
        <Section title="Identity">
          <Field label="Logo URL" value={brand.logo_url ?? ""} onChange={(v) => set("logo_url", v || null)} />
          <Field label="Favicon URL" value={brand.favicon_url ?? ""} onChange={(v) => set("favicon_url", v || null)} />
        </Section>

        <Section title="Color palette">
          <div className="md:col-span-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick presets</div>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
              {PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.name}
                  onClick={() => setBrand((b) => ({ ...b, primary_color: p.primary, secondary_color: p.secondary, accent_color: p.accent }))}
                  className="rounded-lg border border-border p-2 text-left text-xs hover:border-primary"
                >
                  <div className="flex gap-1">
                    <span className="h-5 w-5 rounded" style={{ background: p.primary }} />
                    <span className="h-5 w-5 rounded" style={{ background: p.secondary }} />
                    <span className="h-5 w-5 rounded" style={{ background: p.accent }} />
                  </div>
                  <div className="mt-1 font-medium text-foreground">{p.name}</div>
                </button>
              ))}
            </div>
          </div>
          <ColorField label="Primary" value={brand.primary_color} onChange={(v) => set("primary_color", v)} />
          <ColorField label="Secondary" value={brand.secondary_color} onChange={(v) => set("secondary_color", v)} />
          <ColorField label="Accent" value={brand.accent_color} onChange={(v) => set("accent_color", v)} />
        </Section>

        <Section title="Typography">
          <div className="md:col-span-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Suggested pairings</div>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
              {FONT_PAIRS.map((p) => (
                <button
                  type="button"
                  key={p.heading + p.body}
                  onClick={() => setBrand((b) => ({ ...b, heading_font: p.heading, body_font: p.body }))}
                  className="rounded-lg border border-border p-2 text-left text-xs hover:border-primary"
                >
                  <div className="font-semibold text-foreground" style={{ fontFamily: p.heading }}>{p.heading}</div>
                  <div className="text-muted-foreground" style={{ fontFamily: p.body }}>{p.body}</div>
                </button>
              ))}
            </div>
          </div>
          <Field label="Heading font" value={brand.heading_font ?? ""} onChange={(v) => set("heading_font", v || null)} placeholder="Inter" />
          <Field label="Body font" value={brand.body_font ?? ""} onChange={(v) => set("body_font", v || null)} placeholder="Inter" />
        </Section>

        <Section title="Layout">
          <SelectField
            label="Border radius"
            value={brand.border_radius ?? ""}
            options={[{ label: "Default", value: "" }, ...RADIUS_OPTIONS.map((r) => ({ label: r === "0" ? "Square" : r, value: r }))]}
            onChange={(v) => set("border_radius", v || null)}
          />
          <Field label="Button style" value={brand.button_style ?? ""} onChange={(v) => set("button_style", v || null)} placeholder="rounded" />
          <Field label="Page width" value={brand.page_width ?? ""} onChange={(v) => set("page_width", v || null)} placeholder="1200px" />
        </Section>

        <Section title="SEO & Footer">
          <Field label="SEO title suffix" value={brand.seo_title_suffix ?? ""} onChange={(v) => set("seo_title_suffix", v || null)} placeholder="| Acme Bar Association" />
          <label className="block text-sm md:col-span-2">
            <span className="text-foreground">Footer text</span>
            <textarea
              value={brand.footer_text ?? ""}
              onChange={(e) => set("footer_text", e.target.value || null)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </Section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save brand settings"}
          </button>
        </div>
      </div>

      {/* Live preview */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Live preview</div>
          <div className="overflow-hidden border border-border" style={previewStyle}>
            <div className="flex items-center justify-between px-5 py-3 text-sm" style={{ background: brand.primary_color ?? "#4f46e5", color: "#fff" }}>
              <div className="flex items-center gap-2 font-semibold" style={{ fontFamily: brand.heading_font ?? "Inter" }}>
                {brand.logo_url ? <img src={brand.logo_url} alt="" className="h-5 w-auto" /> : <span>● Brand</span>}
              </div>
              <div className="flex gap-4 text-xs opacity-90">
                <span>Home</span><span>Events</span><span>Members</span>
              </div>
            </div>
            <div className="px-6 py-8">
              <h1 className="text-2xl font-bold" style={{ fontFamily: brand.heading_font ?? "Inter", color: brand.secondary_color ?? "#0f172a" }}>
                Welcome to your bar association
              </h1>
              <p className="mt-2 text-sm opacity-80">A modern home for your members, events, and CLE programming.</p>
              <div className="mt-4 flex gap-2">
                <button type="button" className="px-4 py-2 text-sm font-medium text-white" style={{ background: brand.primary_color ?? "#4f46e5", borderRadius: brand.border_radius ?? "0.5rem" }}>
                  Get started
                </button>
                <button type="button" className="px-4 py-2 text-sm font-medium" style={{ background: brand.accent_color ?? "#f59e0b", color: "#111", borderRadius: brand.border_radius ?? "0.5rem" }}>
                  Learn more
                </button>
              </div>
            </div>
            <div className="border-t px-6 py-3 text-xs opacity-70">
              {brand.footer_text ?? "© Your organization"}
            </div>
          </div>
        </div>
      </aside>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block text-sm">
      <span className="text-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  const safe = value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#4f46e5";
  return (
    <label className="block text-sm">
      <span className="text-foreground">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-border bg-background"
        />
        <input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="#000000"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
    </label>
  );
}

function SelectField({
  label, value, options, onChange,
}: { label: string; value: string; options: Array<{ label: string; value: string }>; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="text-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
