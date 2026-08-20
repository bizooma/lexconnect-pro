import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type MediaItem = {
  name: string;
  path: string;
  url: string;
  size: number;
  createdAt: string | null;
};

function formatSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function useMediaLibrary(bucket: string, organizationId: string) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const { data, error } = await supabase.storage.from(bucket).list(organizationId, {
      limit: 200,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error) {
      toast.error(error.message);
      setItems([]);
    } else {
      setItems(
        (data ?? [])
          .filter((o) => o.id)
          .map((o) => {
            const path = `${organizationId}/${o.name}`;
            return {
              name: o.name,
              path,
              url: supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl,
              size: (o.metadata as { size?: number } | null)?.size ?? 0,
              createdAt: (o.created_at as string | undefined) ?? null,
            };
          }),
      );
    }
    setLoading(false);
  }, [bucket, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, reload: load, setItems };
}

type Props = {
  bucket: string;
  organizationId: string;
  onSelect?: (item: MediaItem) => void;
  allowDelete?: boolean;
  compact?: boolean;
  refreshKey?: number;
};

export function MediaGrid({
  bucket,
  organizationId,
  onSelect,
  allowDelete = false,
  compact = false,
  refreshKey = 0,
}: Props) {
  const { items, loading, reload, setItems } = useMediaLibrary(bucket, organizationId);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (refreshKey) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  }, [items, query]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const { error } = await supabase.storage.from(bucket).remove([pendingDelete.path]);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((prev) => prev.filter((i) => i.path !== pendingDelete.path));
    setPendingDelete(null);
    toast.success("Image deleted");
  };

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search filenames…"
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring/30 focus:ring-2"
      />

      {loading ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Loading media…</p>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          {items.length === 0 ? "No images uploaded yet." : "No filenames match your search."}
        </p>
      ) : (
        <div
          className={`grid gap-3 ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}
        >
          {filtered.map((item) => (
            <div
              key={item.path}
              className="group overflow-hidden rounded-lg border border-border bg-card"
            >
              <button
                type="button"
                onClick={() => onSelect?.(item)}
                disabled={!onSelect}
                className="block aspect-video w-full overflow-hidden bg-muted disabled:cursor-default"
                title={onSelect ? "Use this image" : item.name}
              >
                <img
                  src={item.url}
                  alt={item.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                />
              </button>
              <div className="space-y-1 px-2 py-2">
                <p className="truncate text-[11px] font-medium text-foreground" title={item.name}>
                  {item.name}
                </p>
                {!compact && (
                  <p className="text-[10px] text-muted-foreground">
                    {formatDate(item.createdAt)} · {formatSize(item.size)}
                  </p>
                )}
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(item.url);
                      toast.success("URL copied");
                    }}
                    className="text-[10px] text-muted-foreground hover:text-primary hover:underline"
                  >
                    Copy URL
                  </button>
                  {allowDelete && (
                    <button
                      type="button"
                      onClick={() => setPendingDelete(item)}
                      className="text-[10px] text-destructive hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-elegant">
            <h3 className="text-sm font-semibold text-foreground">Delete this image?</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              <strong className="text-foreground">{pendingDelete.name}</strong> will be permanently
              removed. If this image is used on a page, it will stop displaying there.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
