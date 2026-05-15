import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { listTemplates, useTemplate } from "@/lib/website.functions";
import {
  PAGE_TYPE_LABELS,
  SECTION_LABELS,
  type WebsiteTemplate,
  type WebsitePageType,
  type WebsiteSectionType,
  slugify,
} from "@/lib/website";
import { toast } from "sonner";

export const Route = createFileRoute("/app/website/templates")({
  component: TemplatesPage,
});

type Filter = "all" | WebsitePageType;

function TemplatesPage() {
  const { currentOrgId } = useCurrentOrg();
  const navigate = useNavigate();
  const list = useServerFn(listTemplates);
  const use = useServerFn(useTemplate);
  const [templates, setTemplates] = useState<WebsiteTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<WebsiteTemplate | null>(null);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!currentOrgId) return;
    list({ data: { organizationId: currentOrgId } })
      .then((r) => setTemplates(r.templates as unknown as WebsiteTemplate[]))
      .finally(() => setLoading(false));
  }, [currentOrgId, list]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (filter !== "all" && t.page_type !== filter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [templates, filter, search]);

  const types = useMemo(() => {
    const set = new Set<WebsitePageType>();
    templates.forEach((t) => set.add(t.page_type));
    return Array.from(set);
  }, [templates]);

  const openInstantiate = (t: WebsiteTemplate) => {
    setActive(t);
    setTitle(t.name);
  };

  const apply = async () => {
    if (!currentOrgId || !active || !title.trim()) return;
    setCreating(true);
    try {
      const r = await use({
        data: { templateId: active.id, organizationId: currentOrgId, title: title.trim() },
      });
      toast.success("Page created from template");
      setActive(null);
      navigate({ to: "/app/website/pages/$pageId", params: { pageId: r.pageId } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Pick a template to get a head start. All templates are fully editable after creation.
        </p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates…"
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          All ({templates.length})
        </FilterChip>
        {types.map((t) => {
          const count = templates.filter((x) => x.page_type === t).length;
          return (
            <FilterChip key={t} active={filter === t} onClick={() => setFilter(t)}>
              {PAGE_TYPE_LABELS[t]} ({count})
            </FilterChip>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No templates match your filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const sections = (t.default_sections_json ?? []) as Array<{
              section_type: WebsiteSectionType;
            }>;
            return (
              <article
                key={t.id}
                className="group flex flex-col rounded-xl border border-border bg-card p-4 transition hover:border-primary/50 hover:shadow-sm"
              >
                <div className="relative aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5">
                  {t.preview_image ? (
                    <img src={t.preview_image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col gap-1.5 p-3">
                      {sections.slice(0, 5).map((s, i) => (
                        <div
                          key={i}
                          className="rounded bg-foreground/10"
                          style={{
                            height: s.section_type === "hero" ? "30%" : "12%",
                            width: `${70 + Math.random() * 30}%`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                  <span className="absolute bottom-2 right-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium text-foreground">
                    {sections.length} sections
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-foreground">{t.name}</h3>
                <p className="text-xs text-muted-foreground">{PAGE_TYPE_LABELS[t.page_type]}</p>
                {t.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                )}
                {sections.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {sections.slice(0, 4).map((s, i) => (
                      <span
                        key={i}
                        className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {SECTION_LABELS[s.section_type] ?? s.section_type}
                      </span>
                    ))}
                    {sections.length > 4 && (
                      <span className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        +{sections.length - 4}
                      </span>
                    )}
                  </div>
                )}
                <button
                  onClick={() => openInstantiate(t)}
                  className="mt-3 self-start rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                >
                  Use template
                </button>
              </article>
            );
          })}
        </div>
      )}

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !creating && setActive(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-foreground">Create page from template</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Using <span className="font-medium text-foreground">{active.name}</span>
            </p>
            <label className="mt-4 block text-sm">
              <span className="text-foreground">Page title</span>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") apply();
                }}
              />
              {title && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  Slug: /{slugify(title)}
                </span>
              )}
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setActive(null)}
                disabled={creating}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={apply}
                disabled={creating || !title.trim()}
                className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create page"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
