import { supabase } from "@/integrations/supabase/client";

export const RESOURCE_BUCKET = "resources";
export const MAX_RESOURCE_BYTES = 25 * 1024 * 1024;

export const ALLOWED_RESOURCE_TYPES: Record<string, { ext: string; label: string }> = {
  "application/pdf": { ext: "pdf", label: "PDF" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ext: "docx", label: "DOCX" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { ext: "xlsx", label: "XLSX" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { ext: "pptx", label: "PPTX" },
  "image/jpeg": { ext: "jpg", label: "JPG" },
  "image/png": { ext: "png", label: "PNG" },
};

export const RESOURCE_ACCEPT = Object.keys(ALLOWED_RESOURCE_TYPES).join(",");

export type ResourceCategory =
  | "mentorship_guide"
  | "cle"
  | "template"
  | "checklist"
  | "professional_development"
  | "meeting"
  | "other";

export type ResourceVisibility = "organization" | "conversation" | "meeting" | "qa";

export const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  mentorship_guide: "Mentorship Guides",
  cle: "CLE Materials",
  template: "Templates",
  checklist: "Checklists",
  professional_development: "Professional Development",
  meeting: "Meeting Resources",
  other: "Other",
};

export type ResourceRow = {
  id: string;
  organization_id: string;
  uploaded_by_user_id: string;
  title: string;
  description: string | null;
  storage_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  category: ResourceCategory;
  visibility: ResourceVisibility;
  is_featured: boolean;
  created_at: string;
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateResourceFile(file: File): string | null {
  if (!ALLOWED_RESOURCE_TYPES[file.type]) {
    return "Unsupported file type. Allowed: PDF, DOCX, XLSX, PPTX, JPG, PNG.";
  }
  if (file.size > MAX_RESOURCE_BYTES) {
    return "File exceeds 25MB limit.";
  }
  return null;
}

export type UploadParams = {
  file: File;
  organizationId: string;
  uploaderUserId: string;
  title?: string;
  description?: string | null;
  category: ResourceCategory;
  visibility: ResourceVisibility;
  onProgress?: (pct: number) => void;
};

export async function uploadResource(params: UploadParams): Promise<ResourceRow> {
  const err = validateResourceFile(params.file);
  if (err) throw new Error(err);

  const ext = ALLOWED_RESOURCE_TYPES[params.file.type].ext;
  const id = crypto.randomUUID();
  const path = `${params.organizationId}/${id}.${ext}`;

  // Upload (note: supabase-js doesn't expose progress yet for uploads; we report 0/100)
  params.onProgress?.(10);
  const { error: upErr } = await supabase.storage
    .from(RESOURCE_BUCKET)
    .upload(path, params.file, { contentType: params.file.type, upsert: false });
  if (upErr) throw upErr;
  params.onProgress?.(80);

  const { data, error } = await supabase
    .from("resources")
    .insert({
      id,
      organization_id: params.organizationId,
      uploaded_by_user_id: params.uploaderUserId,
      title: params.title?.trim() || params.file.name,
      description: params.description ?? null,
      storage_path: path,
      file_name: params.file.name,
      file_type: params.file.type,
      file_size: params.file.size,
      category: params.category,
      visibility: params.visibility,
    })
    .select("*")
    .single();
  if (error) {
    // best-effort cleanup
    await supabase.storage.from(RESOURCE_BUCKET).remove([path]);
    throw error;
  }
  params.onProgress?.(100);

  trackResourceEvent("resource_uploaded", {
    category: params.category,
    file_type: params.file.type,
    size: params.file.size,
    visibility: params.visibility,
  });

  return data as ResourceRow;
}

export async function getDownloadUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(RESOURCE_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  if (error || !data?.signedUrl) throw error ?? new Error("Failed to sign URL");
  return data.signedUrl;
}

export function trackResourceEvent(name: string, params: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  try {
    w.gtag?.("event", name, params);
  } catch {
    // ignore
  }
}
