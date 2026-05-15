import { createFileRoute } from "@tanstack/react-router";
import { useIsPlatformAdmin } from "@/hooks/use-is-platform-admin";

export const Route = createFileRoute("/app/cle")({
  component: CleLmsPage,
});

function CleLmsPage() {
  const { isPlatformAdmin } = useIsPlatformAdmin();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Add-on module</p>
      <h1 className="mt-1 font-serif text-3xl font-semibold text-foreground">CLE & Learning</h1>
      <p className="mt-3 text-muted-foreground">
        Continuing Legal Education courses, tracks, and certifications delivered through an integrated LMS.
        This add-on is coming soon.
      </p>
      {isPlatformAdmin && (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin preview</p>
          <p className="mt-2 text-sm text-foreground">
            No courses yet. Course models, enrollment, and tracking will be built out in a follow-up.
          </p>
        </div>
      )}
    </div>
  );
}
