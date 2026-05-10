import { ALLOWED_RESOURCE_TYPES } from "@/lib/resources";

export function FileTypeIcon({ type, className = "h-5 w-5" }: { type: string; className?: string }) {
  const label = ALLOWED_RESOURCE_TYPES[type]?.label ?? "FILE";
  const tone =
    type === "application/pdf"
      ? "bg-red-50 text-red-700 border-red-200"
      : type.includes("word")
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : type.includes("sheet")
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : type.includes("presentation")
            ? "bg-amber-50 text-amber-700 border-amber-200"
            : type.startsWith("image/")
              ? "bg-violet-50 text-violet-700 border-violet-200"
              : "bg-muted text-muted-foreground border-border";
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-md border text-[10px] font-bold tracking-wide ${tone} ${className}`}
    >
      {label}
    </div>
  );
}
