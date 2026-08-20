import { STARTER_PHOTOS } from "@/lib/starter-photos";

function groupByCategory<T extends { category: string }>(items: T[]) {
  return items.reduce((acc, item) => {
    const list = acc[item.category] ?? (acc[item.category] = []);
    list.push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

type Props = {
  onSelect: (url: string) => void;
  compact?: boolean;
};

export function StarterPhotosGrid({ onSelect, compact }: Props) {
  const grouped = groupByCategory(STARTER_PHOTOS);
  const categories = Object.keys(grouped);
  return (
    <div className={`space-y-4 overflow-y-auto pr-1 ${compact ? "max-h-72" : "max-h-[60vh]"}`}>
      {categories.map((category) => (
        <div key={category}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {category}
          </p>
          <div className={`grid gap-2 ${compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"}`}>
            {grouped[category].map((photo) => (
              <button
                key={photo.url}
                type="button"
                onClick={() => onSelect(photo.url)}
                className="group relative overflow-hidden rounded-lg border border-border bg-muted text-left transition hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.label}
                  loading="lazy"
                  className="aspect-video w-full object-cover transition group-hover:scale-105"
                />
                <span className="block truncate px-2 py-1.5 text-[11px] text-foreground">
                  {photo.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
