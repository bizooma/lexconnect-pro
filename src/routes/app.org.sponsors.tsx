import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { ImageUploader } from "@/components/website/ImageUploader";
import { TiersPanel, type SponsorTier } from "@/components/sponsors/TiersPanel";
import { parseSponsorVideoUrl } from "@/lib/sponsors.functions";

export const Route = createFileRoute("/app/org/sponsors")({
  component: SponsorsPage,
});

type Pipeline = "prospect" | "committed" | "active" | "lapsed";

type Sponsor = {
  id: string;
  organization_id: string;
  name: string;
  tier: string;
  tier_rank: number;
  tier_id: string | null;
  category: string | null;
  blurb: string | null;
  offer: string | null;
  logo_url: string | null;
  image_urls: string[];
  website_url: string | null;
  video_provider: string | null;
  video_id: string | null;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  display_order: number;
};


type AdminRow = {
  sponsor_id: string;
  organization_id: string;
  pipeline: Pipeline;
  contact_name: string | null;
  contact_email: string | null;
  annual_amount_cents: number | null;
  notes: string | null;
  renewal_on: string | null;
};

type Stats = { views_30d: number; clicks_30d: number; views_total: number; clicks_total: number };

const PIPELINES: { key: Pipeline; label: string }[] = [
  { key: "prospect", label: "Prospects" },
  { key: "committed", label: "Committed" },
  { key: "active", label: "Active" },
  { key: "lapsed", label: "Lapsed" },
];

const emptyForm = {
  name: "",
  tier: "standard",
  tier_rank: 100,
  tier_id: null as string | null,

  category: "",
  blurb: "",
  offer: "",
  website_url: "",
  logo_url: null as string | null,
  image_urls: [] as string[],
  status: "active",
  starts_on: "",
  ends_on: "",
  display_order: 0,
  video_url: "",
  video_provider: null as string | null,
  video_id: null as string | null,
};

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00Z`).getTime();
  return Math.round((d - Date.now()) / 86_400_000);
}

function SponsorsPage() {
  const { currentOrgId, isOrgAdmin, loading } = useCurrentOrg();
  const { user } = useAuth();
  const parseVideo = useServerFn(parseSponsorVideoUrl);

  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [admins, setAdmins] = useState<Record<string, AdminRow>>({});
  const [tiers, setTiers] = useState<SponsorTier[]>([]);

  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Sponsor | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [pipeForm, setPipeForm] = useState<Partial<AdminRow>>({});
  const [saving, setSaving] = useState(false);

  const categories = useMemo(
    () => Array.from(new Set(sponsors.map((s) => s.category).filter(Boolean) as string[])).sort(),
    [sponsors],
  );

  const refresh = useCallback(async () => {
    if (!currentOrgId) return;
    setBusy(true);
    try {
      const { data: rows, error } = await supabase
        .from("org_sponsors")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("tier_rank")
        .order("display_order")
        .order("name");
      if (error) throw error;
      const list = (rows ?? []) as unknown as Sponsor[];
      setSponsors(list);

      const { data: adminRows } = await supabase
        .from("org_sponsor_admin")
        .select("*")
        .eq("organization_id", currentOrgId);
      const map: Record<string, AdminRow> = {};
      for (const r of (adminRows ?? []) as unknown as AdminRow[]) map[r.sponsor_id] = r;
      setAdmins(map);

      const { data: tierRows } = await supabase
        .from("org_sponsor_tiers")
        .select("id, organization_id, name, rank, annual_price_cents, benefits")
        .eq("organization_id", currentOrgId)
        .order("rank");
      setTiers((tierRows ?? []) as SponsorTier[]);


      const entries = await Promise.all(
        list.map(async (s) => {
          const { data } = await supabase.rpc("get_sponsor_stats" as never, {
            _sponsor_id: s.id,
          } as never);
          return [s.id, (data as unknown as Stats) ?? null] as const;
        }),
      );
      const smap: Record<string, Stats> = {};
      for (const [id, st] of entries) if (st) smap[id] = st;
      setStats(smap);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load sponsors");
    } finally {
      setBusy(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setPipeForm({ pipeline: "prospect" });
    setSheetOpen(true);
  };

  const openEdit = (s: Sponsor) => {
    setEditing(s);
    setForm({
      name: s.name,
      tier: s.tier,
      tier_rank: s.tier_rank,
      category: s.category ?? "",
      blurb: s.blurb ?? "",
      offer: s.offer ?? "",
      website_url: s.website_url ?? "",
      logo_url: s.logo_url,
      image_urls: s.image_urls ?? [],
      status: s.status,
      starts_on: s.starts_on ?? "",
      ends_on: s.ends_on ?? "",
      display_order: s.display_order,
      video_url: "",
      video_provider: s.video_provider,
      video_id: s.video_id,
    });
    setPipeForm(admins[s.id] ?? { pipeline: "active" });
    setSheetOpen(true);
  };

  const save = async () => {
    if (!currentOrgId || !user) return;
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      let provider = form.video_provider;
      let videoId = form.video_id;
      if (form.video_url.trim()) {
        const parsed = await parseVideo({ data: { url: form.video_url.trim() } });
        provider = parsed.provider;
        videoId = parsed.videoId;
      }

      const payload = {
        organization_id: currentOrgId,
        name: form.name.trim(),
        tier: form.tier.trim() || "standard",
        tier_rank: Number(form.tier_rank) || 100,
        category: form.category.trim() || null,
        blurb: form.blurb.trim() || null,
        offer: form.offer.trim() || null,
        website_url: form.website_url.trim() || null,
        logo_url: form.logo_url || null,
        image_urls: form.image_urls,
        video_provider: provider,
        video_id: videoId,
        status: form.status,
        starts_on: form.starts_on || null,
        ends_on: form.ends_on || null,
        display_order: Number(form.display_order) || 0,
      };

      let sponsorId = editing?.id ?? null;
      if (editing) {
        const { error } = await supabase.from("org_sponsors").update(payload as never).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("org_sponsors")
          .insert({ ...payload, created_by: user.id } as never)
          .select("id")
          .single();
        if (error) throw error;
        sponsorId = (data as any).id as string;
      }

      if (sponsorId) {
        const adminPayload = {
          sponsor_id: sponsorId,
          organization_id: currentOrgId,
          pipeline: (pipeForm.pipeline ?? "active") as Pipeline,
          contact_name: pipeForm.contact_name?.trim() || null,
          contact_email: pipeForm.contact_email?.trim() || null,
          annual_amount_cents:
            pipeForm.annual_amount_cents === null || pipeForm.annual_amount_cents === undefined
              ? null
              : Number(pipeForm.annual_amount_cents),
          notes: pipeForm.notes?.trim() || null,
          renewal_on: pipeForm.renewal_on || null,
        };
        const { error: aErr } = await supabase
          .from("org_sponsor_admin")
          .upsert(adminPayload as never, { onConflict: "sponsor_id" });
        if (aErr) throw aErr;
      }

      toast.success(editing ? "Sponsor updated" : "Sponsor added");
      setSheetOpen(false);
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: Sponsor) => {
    if (!confirm(`Delete ${s.name}?`)) return;
    const { error } = await supabase.from("org_sponsors").delete().eq("id", s.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Sponsor deleted");
      refresh();
    }
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!isOrgAdmin) return <Navigate to="/app/dashboard" />;

  const grouped = PIPELINES.map((p) => ({
    ...p,
    rows: sponsors.filter((s) => (admins[s.id]?.pipeline ?? "active") === p.key),
  }));

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Sponsors</h1>
          <p className="text-sm text-muted-foreground">
            Manage sponsorship listings, pipeline, and performance.
          </p>
        </div>
        <Button onClick={openNew}>Add sponsor</Button>
      </div>

      {busy && <p className="text-sm text-muted-foreground">Loading…</p>}

      {grouped.map((group) => (
        <section key={group.key} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label} · {group.rows.length}
          </h2>
          {group.rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No sponsors in this stage.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {group.rows.map((s) => {
                const a = admins[s.id];
                const renewDays = daysUntil(a?.renewal_on ?? null);
                const endDays = daysUntil(s.ends_on);
                const expiring =
                  (renewDays !== null && renewDays <= 60) || (endDays !== null && endDays <= 60);
                const st = stats[s.id];
                return (
                  <div key={s.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start gap-3">
                      {s.logo_url ? (
                        <img
                          src={s.logo_url}
                          alt={`${s.name} logo`}
                          className="h-10 w-10 rounded object-contain"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{s.name}</span>
                          <Badge variant="secondary">{s.tier}</Badge>
                          {s.category ? (
                            <span className="text-xs text-muted-foreground">{s.category}</span>
                          ) : null}
                          {expiring ? (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                              Expiring soon
                            </Badge>
                          ) : null}
                          {s.status !== "active" ? (
                            <Badge variant="outline">{s.status}</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {s.starts_on || "—"} → {s.ends_on || "—"}
                          {a?.renewal_on ? ` · renews ${a.renewal_on}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          30-day: {st?.views_30d ?? 0} views · {st?.clicks_30d ?? 0} clicks
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(s)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ))}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit sponsor" : "Add sponsor"}</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-5">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tier</Label>
                <Input value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tier rank (lower = more prominent)</Label>
                <Input
                  type="number"
                  value={form.tier_rank}
                  onChange={(e) => setForm({ ...form, tier_rank: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Input
                list="sponsor-categories"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Legal tech"
              />
              <datalist id="sponsor-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <Label>Blurb</Label>
              <Textarea
                rows={3}
                value={form.blurb}
                onChange={(e) => setForm({ ...form, blurb: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Member offer</Label>
              <Input
                value={form.offer}
                onChange={(e) => setForm({ ...form, offer: e.target.value })}
                placeholder="Members get 10% off"
              />
            </div>

            <div className="space-y-2">
              <Label>Website URL</Label>
              <Input
                value={form.website_url}
                onChange={(e) => setForm({ ...form, website_url: e.target.value })}
                placeholder="https://example.com"
              />
            </div>

            {currentOrgId ? (
              <ImageUploader
                organizationId={currentOrgId}
                value={form.logo_url}
                onChange={(url) => setForm({ ...form, logo_url: url })}
                label="Logo"
                aspect="square"
              />
            ) : null}

            <div className="space-y-2">
              <Label>Gallery images ({form.image_urls.length}/6)</Label>
              <div className="flex flex-wrap gap-2">
                {form.image_urls.map((url) => (
                  <div key={url} className="relative">
                    <img src={url} alt="Sponsor" className="h-16 w-24 rounded object-cover" />
                    <button
                      type="button"
                      onClick={() =>
                        setForm({ ...form, image_urls: form.image_urls.filter((u) => u !== url) })
                      }
                      className="absolute right-1 top-1 rounded bg-background/90 px-1 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              {currentOrgId && form.image_urls.length < 6 ? (
                <ImageUploader
                  organizationId={currentOrgId}
                  value={null}
                  onChange={(url) => {
                    if (url) setForm((f) => ({ ...f, image_urls: [...f.image_urls, url].slice(0, 6) }));
                  }}
                  label="Add image"
                  hint="Up to 6 images"
                />
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>YouTube or Vimeo URL</Label>
              <Input
                value={form.video_url}
                onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=…"
              />
              {form.video_id ? (
                <p className="text-xs text-muted-foreground">
                  Saved video: {form.video_provider} · {form.video_id}{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setForm({ ...form, video_provider: null, video_id: null, video_url: "" })}
                  >
                    remove
                  </button>
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="hidden">Hidden</SelectItem>
                    <SelectItem value="lapsed">Lapsed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Starts</Label>
                <Input
                  type="date"
                  value={form.starts_on}
                  onChange={(e) => setForm({ ...form, starts_on: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Ends</Label>
                <Input
                  type="date"
                  value={form.ends_on}
                  onChange={(e) => setForm({ ...form, ends_on: e.target.value })}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border p-4">
              <h3 className="text-sm font-semibold">Pipeline (admin only)</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Never shown to members or the public.
              </p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Stage</Label>
                  <Select
                    value={(pipeForm.pipeline ?? "active") as string}
                    onValueChange={(v) => setPipeForm({ ...pipeForm, pipeline: v as Pipeline })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="committed">Committed</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="lapsed">Lapsed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Contact name</Label>
                    <Input
                      value={pipeForm.contact_name ?? ""}
                      onChange={(e) => setPipeForm({ ...pipeForm, contact_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact email</Label>
                    <Input
                      value={pipeForm.contact_email ?? ""}
                      onChange={(e) => setPipeForm({ ...pipeForm, contact_email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Annual amount (USD)</Label>
                    <Input
                      type="number"
                      value={
                        pipeForm.annual_amount_cents === null ||
                        pipeForm.annual_amount_cents === undefined
                          ? ""
                          : pipeForm.annual_amount_cents / 100
                      }
                      onChange={(e) =>
                        setPipeForm({
                          ...pipeForm,
                          annual_amount_cents:
                            e.target.value === "" ? null : Math.round(Number(e.target.value) * 100),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Renewal date</Label>
                    <Input
                      type="date"
                      value={pipeForm.renewal_on ?? ""}
                      onChange={(e) => setPipeForm({ ...pipeForm, renewal_on: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    rows={3}
                    value={pipeForm.notes ?? ""}
                    onChange={(e) => setPipeForm({ ...pipeForm, notes: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pb-8">
              <Button variant="outline" onClick={() => setSheetOpen(false)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save sponsor"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
