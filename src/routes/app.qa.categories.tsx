import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import type { QaCategory } from "@/lib/qa";

export const Route = createFileRoute("/app/qa/categories")({
  component: QaCategories,
});

type CategoryStats = QaCategory & { post_count: number; open_count: number };

function QaCategories() {
  const { currentOrgId } = useCurrentOrg();
  const [categories, setCategories] = useState<CategoryStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrgId) return;
    (async () => {
      setLoading(true);
      const { data: cats } = await supabase
        .from("qa_categories")
        .select("*")
        .eq("organization_id", currentOrgId)
        .eq("archived", false)
        .order("sort_order");
      const list = (cats as QaCategory[]) ?? [];

      const { data: posts } = await supabase
        .from("qa_posts")
        .select("category_id,status")
        .eq("organization_id", currentOrgId);
      const counts = new Map<string, { total: number; open: number }>();
      ((posts as any[]) ?? []).forEach((p) => {
        if (!p.category_id) return;
        const c = counts.get(p.category_id) ?? { total: 0, open: 0 };
        c.total += 1;
        if (p.status === "open") c.open += 1;
        counts.set(p.category_id, c);
      });

      setCategories(
        list.map((c) => ({
          ...c,
          post_count: counts.get(c.id)?.total ?? 0,
          open_count: counts.get(c.id)?.open ?? 0,
        })),
      );
      setLoading(false);
    })();
  }, [currentOrgId]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8 lg:py-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Browse</p>
          <h1 className="font-serif text-2xl font-semibold text-foreground lg:text-3xl">Categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pick an area of practice to see related discussions.</p>
        </div>
        <Link to="/app/qa" className="text-sm font-medium text-primary hover:underline">Back</Link>
      </header>

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <Link
              key={c.id}
              to="/app/qa"
              search={{ category: c.id } as any}
              className="rounded-2xl border border-border bg-card p-5 shadow-card transition hover:shadow-elegant"
            >
              <p className="font-serif text-base font-semibold text-foreground">{c.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.post_count} question{c.post_count === 1 ? "" : "s"} · {c.open_count} open
              </p>
            </Link>
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground">No categories yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
