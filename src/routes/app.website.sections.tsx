import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { listSavedSections, deleteSavedSection } from "@/lib/website.functions";
import { SECTION_LABELS, type WebsiteSavedSection } from "@/lib/website";

export const Route = createFileRoute("/app/website/sections")({
  component: SavedSectionsPage,
});

function SavedSectionsPage() {
  const { currentOrgId } = useCurrentOrg();
  const list = useServerFn(listSavedSections);
  const del = useServerFn(deleteSavedSection);
  const [rows, setRows] = useState<WebsiteSavedSection[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    if (!currentOrgId) return;
    setLoading(true);
    list({ data: { organizationId: currentOrgId } })
      .then((r) => setRows(r.sections as WebsiteSavedSection[]))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, [currentOrgId]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Saved Sections</h2>
        <p className="text-sm text-muted-foreground">
          Reusable section blocks. Save sections from the page editor to use them across multiple pages.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No saved sections yet. Open any page in the editor and use "Save as reusable" on a section.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{SECTION_LABELS[s.section_type]}</p>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete saved section "${s.name}"?`)) return;
                    await del({ data: { savedSectionId: s.id } });
                    toast.success("Deleted");
                    refresh();
                  }}
                  className="text-xs text-destructive hover:underline"
                >
                  Delete
                </button>
              </div>
              <p className="mt-3 line-clamp-3 text-xs text-muted-foreground">
                {((s.content_json as Record<string, unknown>)?.headline as string) ||
                  ((s.content_json as Record<string, unknown>)?.body as string) ||
                  "(no preview)"}
              </p>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Updated {new Date(s.updated_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
