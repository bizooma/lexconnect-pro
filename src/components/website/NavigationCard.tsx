import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listWebsitePages, updateWebsitePage } from "@/lib/website.functions";

type NavPage = {
  id: string;
  title: string;
  slug: string;
  status: string;
  show_in_nav: boolean;
  nav_order: number;
};

export function NavigationCard({ organizationId }: { organizationId: string }) {
  const list = useServerFn(listWebsitePages);
  const upd = useServerFn(updateWebsitePage);
  const [pages, setPages] = useState<NavPage[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await list({ data: { organizationId } });
    setPages((r.pages as unknown as NavPage[]) ?? []);
  }, [list, organizationId]);

  useEffect(() => { void load(); }, [load]);

  const navPages = pages
    .filter((p) => p.show_in_nav)
    .sort((a, b) => a.nav_order - b.nav_order || a.title.localeCompare(b.title));
  const others = pages
    .filter((p) => !p.show_in_nav)
    .sort((a, b) => a.title.localeCompare(b.title));

  const persist = async (rows: NavPage[]) => {
    setBusy(true);
    try {
      await Promise.all(
        rows.map((p) =>
          upd({ data: { pageId: p.id, patch: { show_in_nav: p.show_in_nav, nav_order: p.nav_order } } }),
        ),
      );
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...navPages];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    const renumbered = next.map((p, i) => ({ ...p, nav_order: (i + 1) * 10 }));
    setPages((prev) => prev.map((p) => renumbered.find((r) => r.id === p.id) ?? p));
    void persist(renumbered);
  };

  const toggle = (page: NavPage, show: boolean) => {
    const row = { ...page, show_in_nav: show, nav_order: show ? (navPages.length + 1) * 10 : page.nav_order };
    setPages((prev) => prev.map((p) => (p.id === row.id ? row : p)));
    void persist([row]);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">Navigation</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Pages shown in your public site header. Only published pages appear to visitors.
      </p>

      <ul className="mt-4 space-y-2">
        {navPages.length === 0 && (
          <li className="text-xs text-muted-foreground">No pages in navigation yet.</li>
        )}
        {navPages.map((p, i) => (
          <li key={p.id} className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2">
            <div className="flex flex-col">
              <button
                type="button"
                disabled={busy || i === 0}
                onClick={() => move(i, -1)}
                aria-label={`Move ${p.title} up`}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                ▲
              </button>
              <button
                type="button"
                disabled={busy || i === navPages.length - 1}
                onClick={() => move(i, 1)}
                aria-label={`Move ${p.title} down`}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                ▼
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">{p.title}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                /{p.slug} · {p.status === "published" ? "Published" : "Not published — hidden from visitors"}
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => toggle(p, false)}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      {others.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">Add a page</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {others.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={busy}
                onClick={() => toggle(p, true)}
                className="rounded-full border border-border bg-background px-3 py-1 text-[11px] text-muted-foreground hover:border-primary hover:text-primary"
              >
                + {p.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
