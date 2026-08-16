import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useOrgWellness } from "@/hooks/use-org-wellness";
import { useWellnessCategory } from "@/hooks/use-wellness-category";

export const Route = createFileRoute("/app/wellness/")({
  head: () => ({
    meta: [
      { title: "Well-Being — LexGuild" },
      {
        name: "description",
        content:
          "Lawyer assistance contacts, well-being resources, upcoming programs and wellness CLE for your bar association.",
      },
      { property: "og:title", content: "Well-Being — LexGuild" },
      {
        property: "og:description",
        content: "Lawyer assistance contacts, well-being resources and wellness CLE in one calm place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WellnessPage,
});

type Resource = {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  phone: string | null;
  url: string | null;
  event_date: string | null;
};

const STARTER: Array<Pick<Resource, "kind" | "title" | "description" | "url" | "phone">> = [
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

type WellnessCourse = {
  id: string;
  title: string;
  description: string | null;
  credit_hours: number | null;
  wellness_credit_note: string | null;
};

function WellnessPage() {
  const { user } = useAuth();
  const { currentOrgId, isOrgAdmin } = useCurrentOrg();
  const { wellness, enabled, loading: wellnessLoading } = useOrgWellness();
  const { categoryId } = useWellnessCategory();
  const [resources, setResources] = useState<Resource[] | null>(null);
  const [courses, setCourses] = useState<WellnessCourse[]>([]);
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    if (!currentOrgId || !enabled) return;
    const [{ data: res }, { data: crs }] = await Promise.all([
      supabase
        .from("org_wellness_resources")
        .select("id, kind, title, description, phone, url, event_date")
        .eq("organization_id", currentOrgId)
        .order("display_order")
        .order("created_at"),
      supabase
        .from("ce_courses")
        .select("id, title, description, credit_hours, wellness_credit_note")
        .eq("organization_id", currentOrgId)
        .eq("status", "published")
        .eq("is_wellness", true)
        .order("title"),
    ]);
    setResources((res as Resource[] | null) ?? []);
    setCourses((crs as WellnessCourse[] | null) ?? []);
  };

  useEffect(() => {
    if (!currentOrgId || !enabled) return;
    let cancelled = false;
    (async () => {
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrgId, enabled]);

  const addStarter = async () => {
    if (!currentOrgId || !user) return;
    setSeeding(true);
    const { error } = await supabase.from("org_wellness_resources").insert(
      STARTER.map((s, i) => ({
        organization_id: currentOrgId,
        created_by: user.id,
        kind: s.kind,
        title: s.title,
        description: s.description,
        url: s.url || null,
        phone: s.phone || null,
        display_order: i,
      })),
    );
    setSeeding(false);
    if (error) {
      toast.error("Could not add starter resources", { description: error.message });
      return;
    }
    toast.success("Starter resources added");
    await load();
  };

  if (wellnessLoading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-serif text-2xl font-semibold text-foreground">Well-Being</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your organization hasn’t turned on the Well-Being program yet.
        </p>
      </div>
    );
  }

  const lapName = wellness?.lap_name || "your Lawyer Assistance Program";
  const now = new Date().toISOString();
  const staticResources = (resources ?? []).filter((r) => r.kind === "resource");
  const programs = (resources ?? [])
    .filter((r) => r.kind === "program" && r.event_date && r.event_date >= now)
    .sort((a, b) => (a.event_date! < b.event_date! ? -1 : 1));

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8 lg:py-10">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Support</p>
      <h1 className="font-serif text-2xl font-semibold text-foreground lg:text-3xl">Well-Being</h1>

      {/* LAP banner */}
      <section className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Confidential help
        </p>
        <h2 className="mt-1 font-serif text-xl font-semibold text-foreground lg:text-2xl">{lapName}</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {wellness?.lap_phone && (
            <a
              href={`tel:${wellness.lap_phone.replace(/[^\d+]/g, "")}`}
              className="rounded-xl bg-primary px-5 py-3 text-base font-semibold text-primary-foreground shadow-elegant"
            >
              Call {wellness.lap_phone}
            </a>
          )}
          {wellness?.lap_url && (
            <a
              href={wellness.lap_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-border bg-card px-5 py-3 text-base font-semibold text-foreground hover:border-primary/40"
            >
              Visit website
            </a>
          )}
        </div>
        <p className="mt-4 text-base font-medium text-foreground">
          In crisis?{" "}
          <a href="tel:988" className="underline underline-offset-4">
            Call or text 988.
          </a>
        </p>
      </section>

      {/* Resources */}
      <section className="mt-8">
        <h2 className="mb-3 font-serif text-lg font-semibold text-foreground">Resources</h2>
        {resources === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : staticResources.length === 0 ? (
          <p className="text-sm text-muted-foreground">No resources published yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {staticResources.map((r) => (
              <article key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <h3 className="font-serif text-base font-semibold text-foreground">{r.title}</h3>
                {r.description && <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.phone && (
                    <a
                      href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    >
                      Call {r.phone}
                    </a>
                  )}
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/40"
                    >
                      Visit
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming programs */}
      {programs.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-serif text-lg font-semibold text-foreground">Upcoming programs</h2>
          <div className="space-y-2">
            {programs.map((p) => (
              <article
                key={p.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-card"
              >
                <div className="min-w-0">
                  <h3 className="font-serif text-base font-semibold text-foreground">{p.title}</h3>
                  {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {new Date(p.event_date!).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/40"
                    >
                      Details
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Wellness CLE */}
      {courses.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-serif text-lg font-semibold text-foreground">Well-being CLE</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {courses.map((c) => (
              <Link
                key={c.id}
                to="/app/ce/$courseId"
                params={{ courseId: c.id }}
                className="block rounded-2xl border border-border bg-card p-4 shadow-card transition hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-serif text-base font-semibold text-foreground">{c.title}</h3>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {Number(c.credit_hours || 0).toFixed(1)}h
                  </span>
                </div>
                {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
                {c.wellness_credit_note && (
                  <span className="mt-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    {c.wellness_credit_note}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Q&A link */}
      <section className="mt-8">
        <Link
          to="/app/wellness/discussions"
          className="block rounded-2xl border border-border bg-card p-5 shadow-card transition hover:border-primary/40"
        >
          <h2 className="font-serif text-lg font-semibold text-foreground">Well-Being discussions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Talk with colleagues about balance, stress, and practice health in the community Q&amp;A.
          </p>
        </Link>
      </section>

      <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
        LexGuild organizes your bar’s well-being resources. It is not a counseling or crisis service. If you need
        support now, contact {lapName} or call/text 988.
      </p>
    </div>
  );
}
