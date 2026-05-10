import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { ResourceCard } from "@/components/resources/resource-card";
import { ResourceUploader } from "@/components/resources/resource-uploader";
import { CATEGORY_LABELS, trackResourceEvent, type ResourceCategory, type ResourceRow } from "@/lib/resources";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/org/resources")({
  component: ResourceLibrary,
});

function ResourceLibrary() {
  const { user } = useAuth();
  const { currentOrgId, isOrgAdmin } = useCurrentOrg();
  const [items, setItems] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ResourceCategory | "all">("all");
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = async () => {
    if (!currentOrgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("resources")
      .select("*")
      .eq("organization_id", currentOrgId)
      .eq("visibility", "organization")
      .order("created_at", { ascending: false });
    setItems((data as ResourceRow[] | null) ?? []);
    setLoading(false);
    trackResourceEvent("library_resource_viewed", { org_id: currentOrgId });
  };

  useEffect(() => { load(); }, [currentOrgId]);

  const filtered = useMemo(() => {
    return items.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, search, category]);

  const featured = filtered.filter((r) => r.is_featured);
  const recent = filtered.slice(0, 6);
  const grouped: Record<string, ResourceRow[]> = {};
  for (const r of filtered) (grouped[r.category] ||= []).push(r);

  if (!currentOrgId) return <div className="p-8 text-sm text-muted-foreground">No organization selected.</div>;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 lg:px-8 lg:py-10">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Organization</p>
          <h1 className="mt-1 font-serif text-2xl font-semibold text-foreground lg:text-3xl">Resource Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">Mentorship guides, CLE materials, templates and checklists for your members.</p>
        </div>
        {isOrgAdmin && (
          <Button onClick={() => setUploadOpen(true)}>+ Upload resource</Button>
        )}
      </header>

      <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <strong>Notice:</strong> Do not upload confidential or privileged client information.
      </p>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search resources…"
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring/30 focus:ring-2"
        />
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...(Object.keys(CATEGORY_LABELS) as ResourceCategory[])] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c as any)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${category === c ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:text-foreground"}`}
            >
              {c === "all" ? "All" : CATEGORY_LABELS[c as ResourceCategory]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
          No resources yet.
        </p>
      ) : (
        <div className="space-y-8">
          {featured.length > 0 && (
            <Section title="Featured">
              <div className="grid gap-3 sm:grid-cols-2">
                {featured.map((r) => <ResourceCard key={r.id} resource={r} source="library" />)}
              </div>
            </Section>
          )}
          <Section title="Recently added">
            <div className="grid gap-3 sm:grid-cols-2">
              {recent.map((r) => <ResourceCard key={r.id} resource={r} source="library" />)}
            </div>
          </Section>
          {(Object.keys(grouped) as ResourceCategory[]).map((cat) => (
            <Section key={cat} title={CATEGORY_LABELS[cat]}>
              <div className="grid gap-3 sm:grid-cols-2">
                {grouped[cat].map((r) => <ResourceCard key={r.id} resource={r} source="library" />)}
              </div>
            </Section>
          ))}
        </div>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Upload to library</DialogTitle></DialogHeader>
          {user && currentOrgId && (
            <ResourceUploader
              organizationId={currentOrgId}
              uploaderUserId={user.id}
              visibility="organization"
              defaultCategory="mentorship_guide"
              onUploaded={() => { setUploadOpen(false); load(); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-serif text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
