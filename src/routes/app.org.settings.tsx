import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/app/org/settings")({
  component: OrgSettingsPage,
});

function OrgSettingsPage() {
  const { currentOrgId, currentOrg, isOrgAdmin, refresh } = useCurrentOrg();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [kind, setKind] = useState<"firm" | "bar_association">("firm");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [accentColor, setAccentColor] = useState("#1f3a5f");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentOrgId) return;
    supabase
      .from("organizations")
      .select("name,slug,kind,website,logo_url,accent_color,welcome_message")
      .eq("id", currentOrgId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setName(data.name ?? "");
        setSlug(data.slug ?? "");
        setKind((data.kind as any) ?? "firm");
        setWebsite(data.website ?? "");
        setLogoUrl(data.logo_url ?? "");
        setAccentColor((data as any).accent_color ?? "#1f3a5f");
        setWelcomeMessage((data as any).welcome_message ?? "");
      });
  }, [currentOrgId]);

  if (!currentOrgId) {
    return <div className="p-8 text-sm text-muted-foreground">No organization selected.</div>;
  }

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("organizations")
      .update({
        name,
        slug,
        kind,
        website: website || null,
        logo_url: logoUrl || null,
        accent_color: accentColor,
        welcome_message: welcomeMessage || null,
      })
      .eq("id", currentOrgId);
    setSaving(false);
    if (error) return toast.error("Could not save", { description: error.message });
    toast.success("Organization updated");
    void refresh();
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Organization</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">{currentOrg?.name}</p>
      </header>

      <section className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-card">
        <h2 className="font-serif text-lg font-semibold text-foreground">General</h2>
        <Field label="Name" value={name} onChange={setName} disabled={!isOrgAdmin} />
        <Field label="Slug" value={slug} onChange={setSlug} disabled={!isOrgAdmin} />
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Kind</p>
          <Select value={kind} onValueChange={(v) => setKind(v as any)} disabled={!isOrgAdmin}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="firm">Law firm</SelectItem>
              <SelectItem value="bar_association">Bar association</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Field label="Website" value={website} onChange={setWebsite} placeholder="https://" disabled={!isOrgAdmin} />
      </section>

      <section className="mt-6 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-card">
        <h2 className="font-serif text-lg font-semibold text-foreground">Branding</h2>
        <Field label="Logo URL" value={logoUrl} onChange={setLogoUrl} placeholder="https://…" disabled={!isOrgAdmin} />
        {logoUrl && (
          <img src={logoUrl} alt="Logo preview" className="h-12 w-auto rounded border border-border bg-background p-1" />
        )}
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Accent color</p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              disabled={!isOrgAdmin}
              className="h-10 w-16 cursor-pointer rounded border border-border bg-card"
            />
            <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} disabled={!isOrgAdmin} className="font-mono" />
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Welcome message</p>
          <textarea
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            rows={3}
            disabled={!isOrgAdmin}
            placeholder="Welcome to our community…"
            className="block w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm shadow-card outline-none ring-ring/30 focus:ring-2"
          />
        </div>
      </section>

      {isOrgAdmin && (
        <div className="mt-6">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </div>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, disabled,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <Input
        className="mt-1.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </label>
  );
}
