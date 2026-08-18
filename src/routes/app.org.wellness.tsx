import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useAuth } from "@/hooks/use-auth";
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
import { PulseSurveys } from "@/components/wellness/PulseSurveys";
import { ChallengesAdmin } from "@/components/wellness/ChallengesAdmin";

export const Route = createFileRoute("/app/org/wellness")({
  head: () => ({
    meta: [
      { title: "Well-Being Resources — LexGuild" },
      {
        name: "description",
        content: "Manage your bar's well-being resources and programming for members.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: WellnessAdminPage,
});

type Row = {
  id: string;
  kind: "resource" | "program";
  title: string;
  description: string | null;
  url: string | null;
  phone: string | null;
  event_date: string | null;
  display_order: number;
};

type Draft = {
  id?: string;
  kind: "resource" | "program";
  title: string;
  description: string;
  url: string;
  phone: string;
  event_date: string;
};

const emptyDraft = (): Draft => ({
  kind: "resource",
  title: "",
  description: "",
  url: "",
  phone: "",
  event_date: "",
});

const STARTER: Array<Pick<Draft, "kind" | "title" | "description" | "url" | "phone">> = [
  {
    kind: "resource",
    title: "Florida Lawyers Helpline",
    description:
      "Confidential help for lawyers, paralegals, and law students — up to five free counseling sessions per year.",
    phone: "833-351-9355",
    url: "",
  },
  {
    kind: "resource",
    title: "988 Suicide & Crisis Lifeline",
    description: "Free, confidential crisis support 24/7. Call or text 988.",
    phone: "988",
    url: "",
  },
  {
    kind: "resource",
    title: "Institute for Well-Being in Law",
    description: "Research, programming, and Well-Being Week in Law resources.",
    phone: "",
    url: "https://lawyerwellbeing.net",
  },
  {
    kind: "resource",
    title: "ABA Lawyer Assistance Programs",
    description: "Directory of lawyer assistance programs by state.",
    phone: "",
    url: "https://www.americanbar.org/groups/lawyer_assistance/",
  },
];

function WellnessAdminPage() {
  const { currentOrgId, isOrgAdmin } = useCurrentOrg();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"resources" | "surveys" | "challenges">("resources");

  const load = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("org_wellness_resources")
      .select("id, kind, title, description, url, phone, event_date, display_order")
      .eq("organization_id", currentOrgId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error("Could not load resources", { description: error.message });
      return;
    }
    setRows((data ?? []) as Row[]);
  }, [currentOrgId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!currentOrgId) {
    return <p className="p-8 text-sm text-muted-foreground">Select an organization to begin.</p>;
  }
  if (!isOrgAdmin) {
    return (
      <p className="p-8 text-sm text-muted-foreground">
        Only organization admins can manage well-being resources.
      </p>
    );
  }

  const validate = (d: Draft) => {
    const title = d.title.trim();
    if (!title) {
      toast.error("Title is required");
      return null;
    }
    if (title.length > 120) {
      toast.error("Title must be 120 characters or fewer");
      return null;
    }
    if (d.description.trim().length > 1000) {
      toast.error("Description must be 1000 characters or fewer");
      return null;
    }
    const url = d.url.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      toast.error("Link must start with http:// or https://");
      return null;
    }
    const phone = d.phone.trim();
    if (phone.length > 40) {
      toast.error("Phone must be 40 characters or fewer");
      return null;
    }
    return {
      kind: d.kind,
      title,
      description: d.description.trim() || null,
      url: url || null,
      phone: phone || null,
      event_date:
        d.kind === "program" && d.event_date ? new Date(d.event_date).toISOString() : null,
    };
  };

  const onSave = async () => {
    if (!draft) return;
    const payload = validate(draft);
    if (!payload) return;
    setBusy(true);
    if (draft.id) {
      const { error } = await supabase
        .from("org_wellness_resources")
        .update(payload)
        .eq("id", draft.id);
      setBusy(false);
      if (error) return toast.error("Save failed", { description: error.message });
    } else {
      const { error } = await supabase.from("org_wellness_resources").insert({
        ...payload,
        organization_id: currentOrgId,
        created_by: user?.id ?? "",
        display_order: rows.length,
      });
      setBusy(false);
      if (error) return toast.error("Save failed", { description: error.message });
    }
    setDraft(null);
    toast.success("Saved");
    void load();
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from("org_wellness_resources").delete().eq("id", id);
    if (error) return toast.error("Delete failed", { description: error.message });
    toast.success("Deleted");
    void load();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= rows.length) return;
    const a = rows[index];
    const b = rows[next];
    setBusy(true);
    const results = await Promise.all([
      supabase.from("org_wellness_resources").update({ display_order: next }).eq("id", a.id),
      supabase.from("org_wellness_resources").update({ display_order: index }).eq("id", b.id),
    ]);
    setBusy(false);
    const err = results.find((r) => r.error)?.error;
    if (err) return toast.error("Reorder failed", { description: err.message });
    void load();
  };

  const addStarter = async () => {
    setBusy(true);
    const { error } = await supabase.from("org_wellness_resources").insert(
      STARTER.map((s, i) => ({
        organization_id: currentOrgId,
        created_by: user?.id ?? "",
        kind: s.kind,
        title: s.title,
        description: s.description,
        url: s.url || null,
        phone: s.phone || null,
        display_order: i,
      })),
    );
    setBusy(false);
    if (error) return toast.error("Could not add starter resources", { description: error.message });
    toast.success("Starter resources added");
    void load();
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-5 py-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Organization
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-foreground">
          Well-Being Resources
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Curate the resources and programming your members see.{" "}
          <Link to="/app/org/portal" className="underline underline-offset-2">
            Portal settings
          </Link>
        </p>
      </header>

      <div className="flex gap-2 border-b border-border">
        {(["resources", "surveys", "challenges"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "resources" ? "Resources" : t === "surveys" ? "Pulse surveys" : "Challenges"}
          </button>
        ))}
      </div>

      {tab === "surveys" && <PulseSurveys orgId={currentOrgId} />}
      {tab === "challenges" && <ChallengesAdmin orgId={currentOrgId} />}


      {tab === "resources" && (
        <>
      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-lg font-semibold text-foreground">Items</h2>
          <div className="flex gap-2">
            {!loading && rows.length === 0 && (
              <Button variant="outline" onClick={addStarter} disabled={busy}>
                Add starter resources
              </Button>
            )}
            <Button onClick={() => setDraft(emptyDraft())} disabled={busy}>
              Add item
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No well-being resources yet. Start with the recommended set or add your own.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {rows.map((r, i) => (
              <li key={r.id} className="flex items-start gap-3 py-4">
                <div className="flex flex-col gap-0.5 pt-1">
                  <button
                    className="text-xs disabled:opacity-30"
                    disabled={i === 0 || busy}
                    onClick={() => void move(i, -1)}
                    aria-label="Move up"
                  >
                    ▲
                  </button>
                  <button
                    className="text-xs disabled:opacity-30"
                    disabled={i === rows.length - 1 || busy}
                    onClick={() => void move(i, 1)}
                    aria-label="Move down"
                  >
                    ▼
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{r.title}</p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
                      {r.kind}
                    </span>
                  </div>
                  {r.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.phone && <span className="mr-3">{r.phone}</span>}
                    {r.url && (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2"
                      >
                        {r.url}
                      </a>
                    )}
                    {r.kind === "program" && r.event_date && (
                      <span className="ml-3">{new Date(r.event_date).toLocaleString()}</span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraft({
                        id: r.id,
                        kind: r.kind,
                        title: r.title,
                        description: r.description ?? "",
                        url: r.url ?? "",
                        phone: r.phone ?? "",
                        event_date: r.event_date
                          ? new Date(r.event_date).toISOString().slice(0, 16)
                          : "",
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void onDelete(r.id)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {draft && (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="font-serif text-lg font-semibold text-foreground">
            {draft.id ? "Edit item" : "New item"}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Type
              </p>
              <Select
                value={draft.kind}
                onValueChange={(v) => setDraft({ ...draft, kind: v as "resource" | "program" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resource">Resource</SelectItem>
                  <SelectItem value="program">Program / event</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Title
              </span>
              <Input
                className="mt-1.5"
                maxLength={120}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Description
              </span>
              <textarea
                rows={3}
                maxLength={1000}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none ring-ring/30 focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Link
              </span>
              <Input
                className="mt-1.5"
                placeholder="https://"
                value={draft.url}
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Phone
              </span>
              <Input
                className="mt-1.5"
                maxLength={40}
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
            </label>
            {draft.kind === "program" && (
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Event date
                </span>
                <Input
                  type="datetime-local"
                  className="mt-1.5"
                  value={draft.event_date}
                  onChange={(e) => setDraft({ ...draft, event_date: e.target.value })}
                />
              </label>
            )}
          </div>
          <div className="mt-5 flex gap-2">
            <Button onClick={onSave} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </section>
      )}
        </>
      )}
    </div>

  );
}
