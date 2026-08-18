import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { WELLNESS_DIMENSIONS, dimensionLabel } from "@/lib/wellness-dimensions";

type Props = {
  orgId: string;
  selected: string[] | null;
  onChange: (next: string[]) => void;
};

export function FocusAreasCard({ orgId, selected, onChange }: Props) {
  const { user } = useAuth();
  const [draft, setDraft] = useState<string[]>(selected ?? []);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(selected ?? []);
  }, [selected]);

  const empty = !selected || selected.length === 0;
  const open = editing || empty;

  const toggle = (d: string) =>
    setDraft((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error: delErr } = await supabase
      .from("wellness_preferences")
      .delete()
      .eq("user_id", user.id)
      .eq("organization_id", orgId);
    if (delErr) {
      setSaving(false);
      toast.error("Could not save your focus areas", { description: delErr.message });
      return;
    }
    if (draft.length > 0) {
      const { error } = await supabase.from("wellness_preferences").insert(
        draft.map((dimension) => ({ user_id: user.id, organization_id: orgId, dimension })),
      );
      if (error) {
        setSaving(false);
        toast.error("Could not save your focus areas", { description: error.message });
        return;
      }
    }
    setSaving(false);
    setEditing(false);
    onChange(draft);
    toast.success("Your well-being plan is updated");
  };

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground">Personalize</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick the areas you want to focus on and we’ll shape this page around them.
          </p>
        </div>
        {!open && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit focus areas
          </Button>
        )}
      </div>

      {open ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {WELLNESS_DIMENSIONS.map((d) => {
              const on = draft.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggle(d)}
                  aria-pressed={on}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:border-primary/40"
                  }`}
                >
                  {dimensionLabel(d)}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save focus areas"}
            </Button>
            {!empty && (
              <Button
                variant="ghost"
                onClick={() => {
                  setDraft(selected ?? []);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {selected!.map((d) => (
            <span
              key={d}
              className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {dimensionLabel(d)}
            </span>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Private to you. Your organization only ever sees anonymous totals.
      </p>
    </section>
  );
}
