import { createFileRoute } from "@tanstack/react-router";
import { useIsPlatformAdmin } from "@/hooks/use-is-platform-admin";

export const Route = createFileRoute("/app/directory")({
  component: DirectoryPage,
});

function DirectoryPage() {
  const { isPlatformAdmin } = useIsPlatformAdmin();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Add-on module</p>
      <h1 className="mt-1 font-serif text-3xl font-semibold text-foreground">Attorney Directory</h1>
      <p className="mt-3 text-muted-foreground">
        A searchable directory of vetted attorneys, evolving into a full lawyer referral service.
        This add-on is coming soon.
      </p>
      {isPlatformAdmin && (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin preview</p>
          <p className="mt-2 text-sm text-foreground">
            No directory entries yet. Schema and listings will be built out in a follow-up.
          </p>
        </div>
      )}
    </div>
  );
}
