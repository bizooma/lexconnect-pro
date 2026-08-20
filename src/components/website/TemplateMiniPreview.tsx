import { memo, useEffect, useRef, useState } from "react";
import { PublicSectionRenderer } from "@/components/website/PublicSectionRenderer";
import type { WebsiteSectionType } from "@/lib/website";

type SkeletonSection = {
  section_type: WebsiteSectionType;
  content_json?: Record<string, unknown>;
  settings_json?: Record<string, unknown>;
};

const SCALE = 0.22;

function TemplateMiniPreviewInner({
  sections,
  className = "",
}: {
  sections: unknown;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  const list = (Array.isArray(sections) ? sections : []) as SkeletonSection[];
  const shown = list.filter((s) => s && s.section_type).slice(0, 3);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`relative aspect-video overflow-hidden rounded-lg border border-border bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 ${className}`}
    >
      {visible && shown.length > 0 && (
        <div
          className="pointer-events-none absolute left-0 top-0 select-none"
          style={{
            width: `${100 / SCALE}%`,
            transform: `scale(${SCALE})`,
            transformOrigin: "top left",
          }}
          inert={"" as unknown as boolean}
        >
          {shown.map((s, i) => (
            <PublicSectionRenderer
              key={i}
              section={
                {
                  id: `preview-${i}`,
                  section_type: s.section_type,
                  content_json: s.content_json ?? {},
                  settings_json: s.settings_json ?? {},
                  visible: true,
                } as never
              }
              context={{ preview: true }}
            />
          ))}
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
    </div>
  );
}

export const TemplateMiniPreview = memo(TemplateMiniPreviewInner);
