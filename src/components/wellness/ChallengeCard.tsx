import { Link } from "@tanstack/react-router";
import { dimensionLabel } from "@/lib/wellness-dimensions";

export type ChallengeSummary = {
  id: string;
  title: string;
  description: string | null;
  dimensions: string[];
  kind: string;
  goal_value: number | null;
  unit: string | null;
  starts_on: string;
  ends_on: string;
};

export type ChallengeStats = {
  participants: number;
  community_total: number;
  my_total: number;
  my_days: number;
  joined: boolean;
  completed: boolean;
};

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function ChallengeCard({
  challenge,
  stats,
  onJoin,
  joining,
}: {
  challenge: ChallengeSummary;
  stats?: ChallengeStats;
  onJoin: (id: string) => void;
  joining?: boolean;
}) {
  return (
    <article className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-serif text-base font-semibold text-foreground">{challenge.title}</h3>
        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {fmtDate(challenge.starts_on)} – {fmtDate(challenge.ends_on)}
        </span>
      </div>
      {challenge.description && (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{challenge.description}</p>
      )}
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
      <p className="mt-3 text-xs text-muted-foreground">
        {stats
          ? `${stats.participants} member${stats.participants === 1 ? "" : "s"} joined · Together: ${stats.community_total}${
              challenge.unit ? ` ${challenge.unit}` : ""
            }`
          : "Loading…"}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {stats?.joined ? (
          <Link
            to="/app/wellness/challenges/$challengeId"
            params={{ challengeId: challenge.id }}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-elegant hover:bg-primary/90"
          >
            Open challenge
          </Link>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onJoin(challenge.id)}
              disabled={joining}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-elegant hover:bg-primary/90 disabled:opacity-60"
            >
              {joining ? "Joining…" : "Join"}
            </button>
            <Link
              to="/app/wellness/challenges/$challengeId"
              params={{ challengeId: challenge.id }}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:border-primary/40"
            >
              Details
            </Link>
          </>
        )}
      </div>
    </article>
  );
}
