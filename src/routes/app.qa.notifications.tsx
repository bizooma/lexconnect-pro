import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { toast } from "sonner";

type Mode = "all" | "my_posts" | "followed" | "digest" | "muted";

const OPTIONS: { value: Mode; title: string; desc: string }[] = [
  { value: "all", title: "All new questions and replies", desc: "Notify me whenever something new is posted." },
  { value: "my_posts", title: "Replies to my own questions", desc: "Only my posts and replies addressed to me." },
  { value: "followed", title: "Discussions I follow", desc: "Replies on questions I started or followed." },
  { value: "digest", title: "Daily digest only", desc: "A summary email once a day." },
  { value: "muted", title: "Muted", desc: "Don't send any community notifications." },
];

export const Route = createFileRoute("/app/qa/notifications")({
  component: QaNotifPrefs,
});

function QaNotifPrefs() {
  const { user } = useAuth();
  const { currentOrgId } = useCurrentOrg();
  const [mode, setMode] = useState<Mode>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !currentOrgId) return;
    supabase
      .from("qa_notification_prefs")
      .select("mode")
      .eq("user_id", user.id)
      .eq("organization_id", currentOrgId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.mode) setMode(data.mode as Mode);
        setLoading(false);
      });
  }, [user, currentOrgId]);

  const save = async (next: Mode) => {
    if (!user || !currentOrgId) return;
    setMode(next);
    setSaving(true);
    const { error } = await supabase
      .from("qa_notification_prefs")
      .upsert(
        { user_id: user.id, organization_id: currentOrgId, mode: next },
        { onConflict: "user_id,organization_id" },
      );
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Preferences saved");
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 lg:px-8 lg:py-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Preferences</p>
          <h1 className="font-serif text-2xl font-semibold text-foreground lg:text-3xl">Community notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose how often the Q&amp;A board pings you.</p>
        </div>
        <Link to="/app/qa" className="text-sm font-medium text-primary hover:underline">Back</Link>
      </header>

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-6 space-y-2">
          {OPTIONS.map((o) => (
            <label
              key={o.value}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                mode === o.value ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <input
                type="radio"
                name="qa-mode"
                checked={mode === o.value}
                onChange={() => save(o.value)}
                disabled={saving}
                className="mt-1"
              />
              <div>
                <p className="text-sm font-medium text-foreground">{o.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{o.desc}</p>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
