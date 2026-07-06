import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/ce/catalog")({
  component: Catalog,
});

function Catalog() {
  const { currentOrgId } = useCurrentOrg();
  const [courses, setCourses] = useState<any[] | null>(null);

  useEffect(() => {
    if (!currentOrgId) return;
    supabase
      .from("ce_courses")
      .select("id, title, description, credit_hours, allow_self_enroll")
      .eq("organization_id", currentOrgId)
      .eq("status", "published")
      .order("title")
      .then(({ data }) => setCourses(data ?? []));
  }, [currentOrgId]);

  if (!courses) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (courses.length === 0) return <p className="text-sm text-muted-foreground">No published courses yet.</p>;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {courses.map((c) => (
        <Link key={c.id} to="/app/ce/$courseId" params={{ courseId: c.id }}
          className="block rounded-2xl border border-border bg-card p-4 shadow-card transition hover:border-primary/40">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-serif text-base font-semibold text-foreground">{c.title}</h3>
            <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {Number(c.credit_hours || 0).toFixed(1)}h
            </span>
          </div>
          {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
        </Link>
      ))}
    </div>
  );
}
