import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export type SponsorTier = {
  id: string;
  organization_id: string;
  name: string;
  rank: number;
  annual_price_cents: number | null;
  benefits: string[];
};

const STARTER_TIERS = [
  {
    name: "Platinum",
    rank: 1,
    benefits: ["Premier logo placement", "Featured in every newsletter", "Event passes"],
  },
  {
    name: "Gold",
    rank: 2,
    benefits: ["Prominent logo placement", "Quarterly newsletter feature", "Two event passes"],
  },
  {
    name: "Silver",
    rank: 3,
    benefits: ["Logo in sponsor directory", "Annual newsletter mention", "One event pass"],
  },
];

const emptyDraft = { name: "", rank: 100, price: "", benefits: "" };

export function TiersPanel({
  organizationId,
  tiers,
  onChanged,
}: {
  organizationId: string;
  tiers: SponsorTier[];
  onChanged: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ ...emptyDraft });
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const reset = () => {
    setEditingId(null);
    setAdding(false);
    setDraft({ ...emptyDraft });
  };

  const startAdd = () => {
    setEditingId(null);
    setAdding(true);
    setDraft({ ...emptyDraft, rank: (tiers.at(-1)?.rank ?? 0) + 1 });
  };

  const startEdit = (t: SponsorTier) => {
    setAdding(false);
    setEditingId(t.id);
    setDraft({
      name: t.name,
      rank: t.rank,
      price: t.annual_price_cents === null ? "" : String(t.annual_price_cents / 100),
      benefits: (t.benefits ?? []).join("\n"),
    });
  };

  const parseBenefits = (value: string) =>
    value
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean);

  const save = useCallback(async () => {
    const name = draft.name.trim();
    if (!name) return toast.error("Tier name is required");
    if (name.length > 40) return toast.error("Tier name must be 40 characters or fewer");
    const benefits = parseBenefits(draft.benefits);
    if (benefits.some((b) => b.length > 200)) return toast.error("Each benefit must be 200 characters or fewer");
    const price = draft.price.trim();
    if (price !== "" && (Number.isNaN(Number(price)) || Number(price) < 0)) {
      return toast.error("Price must be a positive number");
    }

    setSaving(true);
    try {
      const payload = {
        organization_id: organizationId,
        name,
        rank: Number(draft.rank) || 100,
        annual_price_cents: price === "" ? null : Math.round(Number(price) * 100),
        benefits,
      };
      if (editingId) {
        const { error } = await supabase.from("org_sponsor_tiers").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        if (!userId) throw new Error("Not signed in");
        const { error } = await supabase
          .from("org_sponsor_tiers")
          .insert({ ...payload, created_by: userId });
        if (error) throw error;
      }
      toast.success(editingId ? "Tier updated" : "Tier added");
      reset();
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Could not save tier");
    } finally {
      setSaving(false);
    }
  }, [draft, editingId, organizationId, onChanged, userId]);

  const move = async (t: SponsorTier, dir: -1 | 1) => {
    const sorted = [...tiers].sort((a, b) => a.rank - b.rank);
    const idx = sorted.findIndex((x) => x.id === t.id);
    const other = sorted[idx + dir];
    if (!other) return;
    const { error: e1 } = await supabase.from("org_sponsor_tiers").update({ rank: other.rank }).eq("id", t.id);
    const { error: e2 } = await supabase.from("org_sponsor_tiers").update({ rank: t.rank }).eq("id", other.id);
    if (e1 || e2) toast.error((e1 ?? e2)!.message);
    onChanged();
  };

  const remove = async (t: SponsorTier) => {
    if (
      !confirm(
        `Delete the "${t.name}" tier? Sponsors assigned to it will become unassigned until you pick a new tier for them.`,
      )
    )
      return;
    const { error } = await supabase.from("org_sponsor_tiers").delete().eq("id", t.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Tier deleted");
      onChanged();
    }
  };

  const addStarters = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("org_sponsor_tiers")
      .insert(STARTER_TIERS.map((t) => ({ ...t, organization_id: organizationId, created_by: userId })));
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Starter tiers added");
      onChanged();
    }
  };

  const sorted = [...tiers].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Sponsorship tiers</h2>
          <p className="text-xs text-muted-foreground">
            Define your tiers once, then assign sponsors to them. Lower rank shows first.
          </p>
        </div>
        <div className="flex gap-2">
          {sorted.length === 0 ? (
            <Button size="sm" variant="outline" onClick={addStarters} disabled={saving || !userId}>
              Add starter tiers
            </Button>
          ) : null}
          <Button size="sm" onClick={startAdd}>
            Add tier
          </Button>
        </div>
      </div>

      {sorted.length === 0 && !adding ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          No tiers yet. Add starter tiers to begin with Platinum, Gold and Silver.
        </p>
      ) : null}

      <div className="space-y-2">
        {sorted.map((t, i) => (
          <div key={t.id} className="rounded-lg border border-border p-3">
            {editingId === t.id ? (
              <TierForm
                draft={draft}
                setDraft={setDraft}
                onCancel={reset}
                onSave={save}
                saving={saving}
                submitLabel="Save tier"
              />
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{t.name}</span>
                    <Badge variant="secondary">Rank {t.rank}</Badge>
                    {t.annual_price_cents !== null ? (
                      <span className="text-xs text-muted-foreground">
                        ${(t.annual_price_cents / 100).toLocaleString()} / year
                      </span>
                    ) : null}
                  </div>
                  {(t.benefits ?? []).length > 0 ? (
                    <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                      {t.benefits.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(t, -1)}>
                    ↑
                  </Button>
                  <Button size="sm" variant="ghost" disabled={i === sorted.length - 1} onClick={() => move(t, 1)}>
                    ↓
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => startEdit(t)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(t)}>
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {adding ? (
          <div className="rounded-lg border border-border p-3">
            <TierForm
              draft={draft}
              setDraft={setDraft}
              onCancel={reset}
              onSave={save}
              saving={saving}
              submitLabel="Add tier"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function TierForm({
  draft,
  setDraft,
  onCancel,
  onSave,
  saving,
  submitLabel,
}: {
  draft: typeof emptyDraft;
  setDraft: (d: typeof emptyDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input
            maxLength={40}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Platinum"
          />
        </div>
        <div className="space-y-2">
          <Label>Rank</Label>
          <Input
            type="number"
            value={draft.rank}
            onChange={(e) => setDraft({ ...draft, rank: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-2">
          <Label>Annual price (USD, optional)</Label>
          <Input
            type="number"
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            placeholder="5000"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Benefits (one per line, 200 characters each)</Label>
        <Textarea
          rows={3}
          value={draft.benefits}
          onChange={(e) => setDraft({ ...draft, benefits: e.target.value })}
          placeholder={"Premier logo placement\nFeatured in every newsletter"}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
