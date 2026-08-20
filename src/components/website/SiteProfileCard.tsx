import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SiteProfile = {
  founded_year: string;
  region: string;
  audience: string;
  tone: string;
  primary_goal: string;
  programs: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

const EMPTY: SiteProfile = {
  founded_year: "",
  region: "",
  audience: "",
  tone: "",
  primary_goal: "",
  programs: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

export function SiteProfileCard({
  organizationId,
  canEdit,
}: {
  organizationId: string;
  canEdit: boolean;
}) {
  const [form, setForm] = useState<SiteProfile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("org_site_profile")
      .select("founded_year, region, audience, tone, primary_goal, programs, contact, notes")
      .eq("organization_id", organizationId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          const c = (data.contact ?? {}) as Record<string, string>;
          setForm({
            founded_year: data.founded_year ? String(data.founded_year) : "",
            region: data.region ?? "",
            audience: data.audience ?? "",
            tone: data.tone ?? "",
            primary_goal: data.primary_goal ?? "",
            programs: (data.programs ?? []).join(", "),
            phone: c["phone"] ?? "",
            email: c["email"] ?? "",
            address: c["address"] ?? "",
            notes: data.notes ?? "",
          });
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const set = (k: keyof SiteProfile, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const year = form.founded_year.trim() ? Number(form.founded_year.trim()) : null;
    if (year !== null && (!Number.isInteger(year) || year < 1700 || year > 2100)) {
      toast.error("Founded year must be between 1700 and 2100");
      return;
    }
    setSaving(true);
    const contact: Record<string, string> = {};
    if (form.phone.trim()) contact["phone"] = form.phone.trim();
    if (form.email.trim()) contact["email"] = form.email.trim();
    if (form.address.trim()) contact["address"] = form.address.trim();
    const { error } = await supabase.from("org_site_profile").upsert(
      {
        organization_id: organizationId,
        founded_year: year,
        region: form.region.trim() || null,
        audience: form.audience || null,
        tone: form.tone || null,
        primary_goal: form.primary_goal.trim() || null,
        programs: form.programs
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        contact,
        notes: form.notes.trim() || null,
      },
      { onConflict: "organization_id" },
    );
    setSaving(false);
    if (error) {
      toast.error("Could not save site profile", { description: error.message });
      return;
    }
    toast.success("Site profile saved");
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">Site profile</h3>
      <p className="mt-1 text-xs text-muted-foreground">The AI uses this on every page it drafts.</p>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-4 space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Founded year</span>
              <Input
                className="mt-1"
                inputMode="numeric"
                placeholder="1897"
                value={form.founded_year}
                disabled={!canEdit}
                onChange={(e) => set("founded_year", e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Region served</span>
              <Input
                className="mt-1"
                placeholder="Jacksonville, Florida"
                value={form.region}
                disabled={!canEdit}
                onChange={(e) => set("region", e.target.value)}
              />
            </label>
            <div>
              <span className="text-xs font-medium text-muted-foreground">Audience</span>
              <Select
                value={form.audience || undefined}
                disabled={!canEdit}
                onValueChange={(v) => set("audience", v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="members">Members</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground">Tone</span>
              <Select value={form.tone || undefined} disabled={!canEdit} onValueChange={(v) => set("tone", v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                  <SelectItem value="modern">Modern</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Primary goal</span>
            <Input
              className="mt-1"
              placeholder="Grow membership"
              maxLength={200}
              value={form.primary_goal}
              disabled={!canEdit}
              onChange={(e) => set("primary_goal", e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Programs (comma separated)</span>
            <Input
              className="mt-1"
              placeholder="mentorship, CLE, wellness"
              value={form.programs}
              disabled={!canEdit}
              onChange={(e) => set("programs", e.target.value)}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Phone</span>
              <Input className="mt-1" value={form.phone} disabled={!canEdit} onChange={(e) => set("phone", e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Email</span>
              <Input className="mt-1" value={form.email} disabled={!canEdit} onChange={(e) => set("email", e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Address</span>
              <Input className="mt-1" value={form.address} disabled={!canEdit} onChange={(e) => set("address", e.target.value)} />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Notes for the AI</span>
            <textarea
              rows={4}
              maxLength={1000}
              value={form.notes}
              disabled={!canEdit}
              placeholder="Anything else the AI should know — history, values, phrases to avoid…"
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-foreground"
              onChange={(e) => set("notes", e.target.value)}
            />
          </label>

          {canEdit ? (
            <Button onClick={save} disabled={saving} size="sm">
              {saving ? "Saving…" : "Save site profile"}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Only organization admins can edit the site profile.</p>
          )}
        </div>
      )}
    </section>
  );
}
