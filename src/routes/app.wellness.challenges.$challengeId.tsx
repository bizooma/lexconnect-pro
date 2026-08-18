import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { dimensionLabel } from "@/lib/wellness-dimensions";
import type { ChallengeStats } from "@/components/wellness/ChallengeCard";

export const Route = createFileRoute("/app/wellness/challenges/$challengeId")({
  head: () => ({
    meta: [
      { title: "Well-Being challenge — LexGuild" },
      {
        name: "description",
        content: "Track your own progress in a bar association well-being challenge. Totals are always collective.",
      },
      { property: "og:title", content: "Well-Being challenge — LexGuild" },
      {
        property: "og:description",
        content: "Join a well-being challenge, check in privately, and see your bar's collective progress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChallengeDetail,
});

type Challenge = {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  dimensions: string[];
  kind: string;
  goal_value: number | null;
  unit: string | null;
  starts_on: string;
  ends_on: string;
  status: string;
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function ChallengeDetail() {
  const { challengeId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrgId } = useCurrentOrg();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [stats, setStats] = useState<ChallengeStats | null>(null);
  const [todayValue, setTodayValue] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("wellness_challenges")
      .select("id, organization_id, title, description, dimensions, kind, goal_value, unit, starts_on, ends_on, status")
      .eq("id", challengeId)
      .maybeSingle();
    if (error || !data) {
      setChallenge(null);
      setLoading(false);
      return;
    }
    setChallenge(data as Challenge);

    const { data: s } = await supabase.rpc("get_challenge_stats", { _challenge_id: challengeId });
    if (s) setStats(s as unknown as ChallengeStats);

    const { data: row } = await supabase
      .from("wellness_challenge_checkins")
      .select("value")
      .eq("challenge_id", challengeId)
      .eq("user_id", user.id)
      .eq("occurred_on", todayStr())
      .maybeSingle();
    setTodayValue(row ? (row.value as number) : null);
    if (row) setAmount(String(row.value));
    setLoading(false);
  }, [challengeId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const maybeComplete = async (myTotal: number) => {
    if (!user || !challenge?.goal_value) return;
    if (myTotal < challenge.goal_value) return;
    await supabase
      .from("wellness_challenge_participants")
      .update({ completed_at: new Date().toISOString() })
      .eq("challenge_id", challengeId)
      .eq("user_id", user.id)
      .is("completed_at", null);
  };

  const join = async () => {
    if (!user || !challenge) return;
    setBusy(true);
    const { error } = await supabase.from("wellness_challenge_participants").insert({
      challenge_id: challenge.id,
      user_id: user.id,
      organization_id: challenge.organization_id,
    });
    setBusy(false);
    if (error) {
      toast.error("Could not join", { description: error.message });
      return;
    }
    toast.success("You’re in");
    await load();
  };

  const leave = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("wellness_challenge_participants")
      .delete()
      .eq("challenge_id", challengeId)
      .eq("user_id", user.id);
    setBusy(false);
    if (error) {
      toast.error("Could not leave the challenge", { description: error.message });
      return;
    }
    toast.message("You left this challenge");
    navigate({ to: "/app/wellness" });
  };

  const saveCheckin = async (value: number) => {
    if (!user || !challenge) return;
    setBusy(true);
    const { error } = await supabase
      .from("wellness_challenge_checkins")
      .upsert(
        {
          challenge_id: challenge.id,
          user_id: user.id,
          organization_id: challenge.organization_id,
          occurred_on: todayStr(),
          value,
        },
        { onConflict: "challenge_id,user_id,occurred_on" },
      );
    if (error) {
      setBusy(false);
      toast.error("Could not save your check-in", { description: error.message });
      return;
    }
    const nextTotal = (stats?.my_total ?? 0) - (todayValue ?? 0) + value;
    await maybeComplete(nextTotal);
    setBusy(false);
    toast.success("Saved");
    await load();
  };

  const markPledgeComplete = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("wellness_challenge_participants")
      .update({ completed_at: new Date().toISOString() })
      .eq("challenge_id", challengeId)
      .eq("user_id", user.id);
    setBusy(false);
    if (error) {
      toast.error("Could not mark complete", { description: error.message });
      return;
    }
    await load();
  };

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!challenge || (currentOrgId && challenge.organization_id !== currentOrgId)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-serif text-2xl font-semibold text-foreground">Challenge not found</h1>
        <Link to="/app/wellness" className="mt-3 inline-block text-sm text-primary underline underline-offset-4">
          Back to Well-Being
        </Link>
      </div>
    );
  }

  const goal = challenge.goal_value ?? 0;
  const myTotal = stats?.my_total ?? 0;
  const pct = goal > 0 ? Math.min(100, Math.round((myTotal / goal) * 100)) : 0;
  const unit = challenge.unit ? ` ${challenge.unit}` : "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-10">
      <Link to="/app/wellness" className="text-xs font-medium text-muted-foreground hover:text-foreground">
        ← Well-Being
      </Link>
      <h1 className="mt-2 font-serif text-2xl font-semibold text-foreground lg:text-3xl">{challenge.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {fmtDate(challenge.starts_on)} – {fmtDate(challenge.ends_on)}
      </p>
      {challenge.dimensions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {challenge.dimensions.map((d) => (
            <span
              key={d}
              className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary"
            >
              {dimensionLabel(d)}
            </span>
          ))}
        </div>
      )}
      {challenge.description && <p className="mt-4 text-sm text-muted-foreground">{challenge.description}</p>}

      {stats?.completed && (
        <section className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center shadow-card">
          <h2 className="font-serif text-lg font-semibold text-foreground">Congratulations — you finished! 🎉</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Thanks for taking part. Every check-in adds to your bar’s collective total.
          </p>
        </section>
      )}

      {!stats?.joined ? (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">
            {stats
              ? `Together: ${stats.community_total}${unit} from ${stats.participants} member${
                  stats.participants === 1 ? "" : "s"
                }.`
              : ""}
          </p>
          <Button className="mt-4" onClick={join} disabled={busy}>
            {busy ? "Joining…" : "Join this challenge"}
          </Button>
        </section>
      ) : (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
          {challenge.kind === "daily_checkin" && (
            <Button
              className="w-full py-6 text-base"
              disabled={busy || todayValue !== null}
              onClick={() => saveCheckin(1)}
            >
              {todayValue !== null ? "Checked in ✓" : "Check in for today"}
            </Button>
          )}

          {challenge.kind === "cumulative" && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[12rem] flex-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="amount">
                  Add today’s {challenge.unit || "total"}
                </label>
                <Input
                  id="amount"
                  type="number"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <Button
                disabled={busy || amount === "" || Number.isNaN(Number(amount))}
                onClick={() => saveCheckin(Math.max(0, Math.round(Number(amount))))}
              >
                {todayValue !== null ? "Update today" : "Save"}
              </Button>
            </div>
          )}

          {challenge.kind === "pledge" && (
            <Button
              className="w-full py-6 text-base"
              disabled={busy || Boolean(stats?.completed)}
              onClick={markPledgeComplete}
            >
              {stats?.completed ? "Completed ✓" : "Mark complete"}
            </Button>
          )}

          {goal > 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Your progress</span>
                <span>
                  {myTotal} / {goal}
                  {unit}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-accent">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          <p className="mt-4 text-sm text-muted-foreground">
            Together: {stats?.community_total ?? 0}
            {unit} from {stats?.participants ?? 0} member{(stats?.participants ?? 0) === 1 ? "" : "s"}.
          </p>

          <button
            type="button"
            onClick={leave}
            disabled={busy}
            className="mt-4 text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Leave challenge
          </button>
        </section>
      )}

      <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
        Your check-ins are private to you. Only collective totals are ever shown — never another member’s name or
        progress.
      </p>
    </div>
  );
}
