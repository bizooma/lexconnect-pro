import { useState } from "react";
import { FileTypeIcon } from "./file-type-icon";
import { formatBytes, getDownloadUrl, trackResourceEvent, type ResourceRow } from "@/lib/resources";
import { toast } from "sonner";

type Props = {
  resource: ResourceRow;
  source: "library" | "message" | "meeting";
  uploaderName?: string | null;
  compact?: boolean;
  onDeleted?: () => void;
};

export function ResourceCard({ resource, source, uploaderName, compact }: Props) {
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    setBusy(true);
    try {
      const url = await getDownloadUrl(resource.storage_path);
      trackResourceEvent("resource_downloaded", { resource_id: resource.id, source });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not generate download link");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`group flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card transition hover:border-primary/40 ${compact ? "" : "sm:p-4"}`}
    >
      <FileTypeIcon type={resource.file_type} className={compact ? "h-9 w-9" : "h-11 w-11"} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{resource.title}</p>
        {resource.description && !compact && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{resource.description}</p>
        )}
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
          {formatBytes(resource.file_size)}
          {uploaderName ? ` · ${uploaderName}` : ""}
          {!compact ? ` · ${new Date(resource.created_at).toLocaleDateString()}` : ""}
        </p>
      </div>
      {resource.is_featured && !compact && (
        <span className="hidden rounded-full bg-gradient-gold px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary sm:inline-flex">
          Featured
        </span>
      )}
      <button
        onClick={handleDownload}
        disabled={busy}
        className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-accent disabled:opacity-60"
        aria-label={`Download ${resource.title}`}
      >
        {busy ? "…" : "Download"}
      </button>
    </div>
  );
}
