import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { supabase } from "@/integrations/supabase/client";
import { MediaGrid } from "@/components/website/MediaLibrary";
import { toast } from "sonner";

export const Route = createFileRoute("/app/website/media")({
  component: MediaPage,
  head: () => ({
    meta: [
      { title: "Media Library — Website Builder" },
      {
        name: "description",
        content: "Browse, upload, and manage the images used across your organization's pages.",
      },
      { property: "og:title", content: "Media Library — Website Builder" },
      {
        property: "og:description",
        content: "Browse, upload, and manage the images used across your organization's pages.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const BUCKET = "website-media";
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

function MediaPage() {
  const { currentOrgId, canEditWebsite } = useCurrentOrg();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  if (!currentOrgId) {
    return <p className="text-sm text-muted-foreground">Select an organization first.</p>;
  }

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
      const path = `${currentOrgId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      toast.success("Image uploaded");
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error((e as Error).message ?? "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Media library</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every image uploaded for your pages, sponsors, and branding.
          </p>
        </div>
        {canEditWebsite && (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-elegant hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Uploading…" : "Upload image"}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED.join(",")}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
          className="hidden"
        />
      </div>

      <MediaGrid
        bucket={BUCKET}
        organizationId={currentOrgId}
        allowDelete={canEditWebsite}
        refreshKey={refreshKey}
      />
    </div>
  );
}
