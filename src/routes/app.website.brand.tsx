import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

  const set = <K extends keyof Brand>(k: K, v: Brand[K]) => setBrand({ ...brand, [k]: v });

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <form onSubmit={save} className="mx-auto max-w-3xl space-y-6">
      <Section title="Identity">
        <Field label="Logo URL" value={brand.logo_url ?? ""} onChange={(v) => set("logo_url", v || null)} />
        <Field label="Favicon URL" value={brand.favicon_url ?? ""} onChange={(v) => set("favicon_url", v || null)} />
      </Section>

      <Section title="Colors">
        <Field label="Primary color" value={brand.primary_color ?? ""} onChange={(v) => set("primary_color", v || null)} placeholder="#0487AF" />
        <Field label="Secondary color" value={brand.secondary_color ?? ""} onChange={(v) => set("secondary_color", v || null)} />
        <Field label="Accent color" value={brand.accent_color ?? ""} onChange={(v) => set("accent_color", v || null)} />
      </Section>

      <Section title="Typography">
        <Field label="Heading font" value={brand.heading_font ?? ""} onChange={(v) => set("heading_font", v || null)} placeholder="Inter" />
        <Field label="Body font" value={brand.body_font ?? ""} onChange={(v) => set("body_font", v || null)} />
      </Section>

      <Section title="Layout">
        <Field label="Button style" value={brand.button_style ?? ""} onChange={(v) => set("button_style", v || null)} placeholder="rounded" />
        <Field label="Page width" value={brand.page_width ?? ""} onChange={(v) => set("page_width", v || null)} placeholder="1200px" />
        <Field label="Border radius" value={brand.border_radius ?? ""} onChange={(v) => set("border_radius", v || null)} placeholder="0.5rem" />
      </Section>

      <Section title="SEO & Footer">
        <Field label="SEO title suffix" value={brand.seo_title_suffix ?? ""} onChange={(v) => set("seo_title_suffix", v || null)} placeholder="| Acme Bar Association" />
        <label className="block text-sm">
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
