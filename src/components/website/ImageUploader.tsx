import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BUCKET = "website-media";
const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

type Props = {
  organizationId: string;
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  label?: string;
  hint?: string;
  aspect?: "video" | "square" | "wide";
};

export function ImageUploader({
  organizationId,
  value,
  onChange,
  label = "Image",
  hint,
  aspect = "video",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const aspectClass =
    aspect === "square" ? "aspect-square" : aspect === "wide" ? "aspect-[1200/630]" : "aspect-video";

  const upload = async (file: File) => {
    if (!ALLOWED.includes(file.type)) {
      toast.error("Use JPG, PNG, WebP, GIF, or SVG");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image must be under 8MB");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${organizationId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error((e as Error).message ?? "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[11px] text-destructive hover:underline"
          >
            Remove
          </button>
        )}
      </div>
      {value ? (
        <div className={`relative w-full overflow-hidden rounded-lg border border-border bg-muted ${aspectClass}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) upload(f);
          }}
          className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-background px-3 py-6 text-center ${aspectClass}`}
        >
          <p className="text-[11px] text-muted-foreground">Drop image or</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="rounded border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-primary/40 disabled:opacity-50"
          >
            {busy ? "Uploading…" : "Choose file"}
          </button>
          {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED.join(",")}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
        className="hidden"
      />
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder="Or paste an image URL"
        className="w-full rounded border border-border bg-background px-2 py-1.5 text-[11px] text-foreground"
      />
    </div>
  );
}
