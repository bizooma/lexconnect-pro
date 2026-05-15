import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { listTemplates, useTemplate } from "@/lib/website.functions";
import { PAGE_TYPE_LABELS, type WebsiteTemplate } from "@/lib/website";
import { toast } from "sonner";

export const Route = createFileRoute("/app/website/templates")({
  component: TemplatesPage,
});

function TemplatesPage() {
  const { currentOrgId } = useCurrentOrg();
  const navigate = useNavigate();
  const list = useServerFn(listTemplates);
  const use = useServerFn(useTemplate);
  const [templates, setTemplates] = useState<WebsiteTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrgId) return;
    list({ data: { organizationId: currentOrgId } })
      .then((r) => setTemplates(r.templates as unknown as WebsiteTemplate[]))
      .finally(() => setLoading(false));
  }, [currentOrgId, list]);

  const apply = async (t: WebsiteTemplate) => {
    if (!currentOrgId) return;
    const title = prompt(`Title for new page from "${t.name}":`, t.name);
    if (!title) return;
    try {
      const r = await use({ data: { templateId: t.id, organizationId: currentOrgId, title } });
      toast.success("Page created from template");
      navigate({ to: "/app/website/pages/$pageId", params: { pageId: r.pageId } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Pick a template to get a head start. All templates are fully editable after creation.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <article key={t.id} className="flex flex-col rounded-xl border border-border bg-card p-4">
            <div className="aspect-video rounded-lg bg-gradient-to-br from-primary/10 to-accent/10" />
            <h3 className="mt-3 text-sm font-semibold text-foreground">{t.name}</h3>
            <p className="text-xs text-muted-foreground">{PAGE_TYPE_LABELS[t.page_type]}</p>
            {t.description && <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>}
            <button
              onClick={() => apply(t)}
              className="mt-3 self-start rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Use template
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
