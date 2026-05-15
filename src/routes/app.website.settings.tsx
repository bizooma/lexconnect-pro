import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { getBrandSettings, updateBrandSettings } from "@/lib/website.functions";
import type { WebsiteBrandSettings } from "@/lib/website";

export const Route = createFileRoute("/app/website/settings")({
  component: WebsiteSettingsPage,
});

function WebsiteSettingsPage() {
  const { currentOrgId } = useCurrentOrg();
  const get = useServerFn(getBrandSettings);
  const upd = useServerFn(updateBrandSettings);
  const [brand, setBrand] = useState<WebsiteBrandSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentOrgId) return;
    get({ data: { organizationId: currentOrgId } }).then((r) => setBrand(r.brand as WebsiteBrandSettings));
  }, [currentOrgId, get]);

  const save = async (patch: Partial<WebsiteBrandSettings>) => {
    if (!currentOrgId || !brand) return;
    setBrand({ ...brand, ...patch });
    setSaving(true);
    try {
      await upd({ data: { organizationId: currentOrgId, patch: patch as any } });
      toast.success("Saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!brand) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Module Settings</h2>
        <p className="text-sm text-muted-foreground">SEO defaults, footer, and module-wide options for the Website Builder.</p>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground">SEO defaults</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Applied as a fallback to all pages that don't override these values.
        </p>
        <div className="mt-4 space-y-3 text-sm">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">SEO title suffix</span>
            <input
              defaultValue={brand.seo_title_suffix ?? ""}
              onBlur={(e) => save({ seo_title_suffix: e.target.value || null })}
              placeholder=" | LexGuild"
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-foreground"
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Appended to every page's meta title. Example: "About Us" → "About Us | LexGuild".
            </span>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground">Footer</h3>
        <label className="mt-3 block text-sm">
          <span className="text-xs font-medium text-muted-foreground">Footer text</span>
          <textarea
            defaultValue={brand.footer_text ?? ""}
            onBlur={(e) => save({ footer_text: e.target.value || null })}
            rows={3}
            placeholder="© 2026 Your Bar Association. All rights reserved."
            className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-foreground"
          />
        </label>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground">Roles & permissions</h3>
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Owners and admins</span> can build, edit, schedule, publish, archive, and manage domains.
          </p>
          <p>
            <span className="font-medium text-foreground">Content editors</span> can build and edit pages and send them for review, but cannot publish, schedule, or archive — those actions are reserved for owners and admins.
          </p>
          <p>
            All other members have read-only access to the public site.
          </p>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">{saving ? "Saving…" : "All changes saved."}</p>
    </div>
  );
}
