import { useRef, useState } from "react";
import {
  CATEGORY_LABELS,
  RESOURCE_ACCEPT,
  uploadResource,
  validateResourceFile,
  type ResourceCategory,
  type ResourceRow,
  type ResourceVisibility,
} from "@/lib/resources";
import { toast } from "sonner";

type Props = {
  organizationId: string;
  uploaderUserId: string;
  visibility: ResourceVisibility;
  defaultCategory?: ResourceCategory;
  showCategory?: boolean;
  showTitle?: boolean;
  buttonLabel?: string;
  compact?: boolean;
  onUploaded: (resource: ResourceRow) => void;
};

export function ResourceUploader({
  organizationId,
  uploaderUserId,
  visibility,
  defaultCategory = "other",
  showCategory = true,
  showTitle = true,
  buttonLabel = "Upload resource",
  compact,
  onUploaded,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ResourceCategory>(defaultCategory);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  const pickFile = (f: File | null) => {
    if (!f) return;
    const err = validateResourceFile(f);
    if (err) {
      toast.error(err);
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const submit = async () => {
    if (!file) {
      toast.error("Choose a file to upload");
      return;
    }
    setBusy(true);
    setProgress(5);
    try {
      const row = await uploadResource({
        file,
        organizationId,
        uploaderUserId,
        title: showTitle ? title : file.name,
        description: description.trim() || null,
        category,
        visibility,
        onProgress: setProgress,
      });
      toast.success("Resource uploaded");
      onUploaded(row);
      setFile(null);
      setTitle("");
      setDescription("");
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`space-y-3 ${compact ? "" : ""}`}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) pickFile(f);
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 text-center transition ${drag ? "border-primary bg-primary/5" : "border-border bg-background"}`}
      >
        <p className="text-sm font-medium text-foreground">
          {file ? file.name : "Drop a file here"}
        </p>
        <p className="text-[11px] text-muted-foreground">
          PDF, DOCX, XLSX, PPTX, JPG, PNG · max 25MB
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40"
        >
          {file ? "Change file" : "Choose file"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={RESOURCE_ACCEPT}
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          className="hidden"
        />
      </div>

      {showTitle && (
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring/30 focus:ring-2"
          maxLength={120}
        />
      )}
      {!compact && (
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description (optional)"
          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring/30 focus:ring-2"
          maxLength={500}
        />
      )}
      {showCategory && (
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ResourceCategory)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring/30 focus:ring-2"
        >
          {(Object.keys(CATEGORY_LABELS) as ResourceCategory[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      )}

      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
        <strong>Upload notice:</strong> Do not upload confidential or privileged client information.
      </p>

      {busy && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <button
        onClick={submit}
        disabled={busy || !file}
        className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-elegant transition hover:bg-primary/90 disabled:opacity-60"
      >
        {busy ? "Uploading…" : buttonLabel}
      </button>
    </div>
  );
}
