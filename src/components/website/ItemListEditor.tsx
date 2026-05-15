import type { WebsiteSectionType } from "@/lib/website";

type FieldDef = { key: string; label: string; type: "text" | "textarea" | "list" };

const SCHEMAS: Partial<Record<WebsiteSectionType, FieldDef[]>> = {
  feature_grid: [
    { key: "title", label: "Title", type: "text" },
    { key: "body", label: "Description", type: "textarea" },
    { key: "icon", label: "Icon (emoji or URL)", type: "text" },
  ],
  stats: [
    { key: "value", label: "Value (e.g. 1.2K)", type: "text" },
    { key: "label", label: "Label", type: "text" },
  ],
  faq: [
    { key: "question", label: "Question", type: "text" },
    { key: "answer", label: "Answer", type: "textarea" },
  ],
  testimonials: [
    { key: "quote", label: "Quote", type: "textarea" },
    { key: "author", label: "Author", type: "text" },
    { key: "role", label: "Role / company", type: "text" },
  ],
  pricing_tiers: [
    { key: "tier", label: "Tier name", type: "text" },
    { key: "price", label: "Price", type: "text" },
    { key: "features", label: "Features (one per line)", type: "list" },
    { key: "cta_label", label: "Button label", type: "text" },
    { key: "cta_href", label: "Button link", type: "text" },
  ],
  event_details: [
    { key: "date", label: "Date / time", type: "text" },
    { key: "title", label: "Title", type: "text" },
    { key: "body", label: "Details", type: "textarea" },
  ],
  sponsor_grid: [
    { key: "name", label: "Sponsor name", type: "text" },
    { key: "logo_url", label: "Logo URL", type: "text" },
    { key: "href", label: "Link", type: "text" },
  ],
  speaker_cards: [
    { key: "name", label: "Name", type: "text" },
    { key: "role", label: "Role / title", type: "text" },
    { key: "bio", label: "Bio", type: "textarea" },
    { key: "image_url", label: "Photo URL", type: "text" },
  ],
  committee_cards: [
    { key: "name", label: "Name", type: "text" },
    { key: "role", label: "Role", type: "text" },
    { key: "image_url", label: "Photo URL", type: "text" },
  ],
  resource_cards: [
    { key: "title", label: "Title", type: "text" },
    { key: "body", label: "Description", type: "textarea" },
    { key: "href", label: "Link", type: "text" },
  ],
  member_directory: [
    { key: "name", label: "Name", type: "text" },
    { key: "role", label: "Role / firm", type: "text" },
    { key: "image_url", label: "Photo URL", type: "text" },
  ],
  timeline: [
    { key: "date", label: "Date", type: "text" },
    { key: "title", label: "Title", type: "text" },
    { key: "body", label: "Description", type: "textarea" },
  ],
};

export function getItemSchema(t: WebsiteSectionType): FieldDef[] | null {
  return SCHEMAS[t] ?? null;
}

type Item = Record<string, unknown>;

export function ItemListEditor({
  sectionType,
  items,
  onChange,
}: {
  sectionType: WebsiteSectionType;
  items: Item[];
  onChange: (next: Item[]) => void;
}) {
  const schema = getItemSchema(sectionType);
  if (!schema) return null;

  const blank: Item = Object.fromEntries(schema.map((f) => [f.key, f.type === "list" ? [] : ""]));

  const update = (i: number, key: string, value: unknown) => {
    const next = items.slice();
    next[i] = { ...next[i], [key]: value };
    onChange(next);
  };
  const remove = (i: number) => {
    const next = items.slice();
    next.splice(i, 1);
    onChange(next);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => onChange([...items, { ...blank }]);

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Items</p>
      {items.length === 0 && (
        <p className="rounded border border-dashed border-border p-2 text-[11px] text-muted-foreground">
          No items yet. Add one to populate this section.
        </p>
      )}
      {items.map((it, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-border bg-background p-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>#{i + 1}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded px-1.5 hover:bg-accent disabled:opacity-30" aria-label="Move up">↑</button>
              <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="rounded px-1.5 hover:bg-accent disabled:opacity-30" aria-label="Move down">↓</button>
              <button onClick={() => remove(i)} className="rounded px-1.5 text-destructive hover:bg-destructive/10" aria-label="Remove">×</button>
            </div>
          </div>
          {schema.map((f) => {
            const v = (it as Record<string, unknown>)[f.key];
            if (f.type === "textarea") {
              return (
                <label key={f.key} className="block text-xs">
                  <span className="text-muted-foreground">{f.label}</span>
                  <textarea
                    value={typeof v === "string" ? v : ""}
                    onChange={(e) => update(i, f.key, e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-foreground"
                  />
                </label>
              );
            }
            if (f.type === "list") {
              const lines = Array.isArray(v) ? (v as string[]).join("\n") : typeof v === "string" ? v : "";
              return (
                <label key={f.key} className="block text-xs">
                  <span className="text-muted-foreground">{f.label}</span>
                  <textarea
                    value={lines}
                    onChange={(e) =>
                      update(
                        i,
                        f.key,
                        e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                      )
                    }
                    rows={3}
                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-foreground"
                  />
                </label>
              );
            }
            return (
              <label key={f.key} className="block text-xs">
                <span className="text-muted-foreground">{f.label}</span>
                <input
                  value={typeof v === "string" ? v : ""}
                  onChange={(e) => update(i, f.key, e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-foreground"
                />
              </label>
            );
          })}
        </div>
      ))}
      <button
        onClick={add}
        className="w-full rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"
      >
        + Add item
      </button>
    </div>
  );
}
