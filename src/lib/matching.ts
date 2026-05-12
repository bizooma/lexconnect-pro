import type { Profile } from "@/hooks/use-profiles";

export type MatchReason = string;
export type MatchResult = {
  profile: Profile;
  score: number;
  reasons: MatchReason[];
  /** True if mentor relative to viewer (i.e. viewer is mentee, candidate is mentor) */
  candidateIsMentor: boolean;
};

/** Existing relationship signal so we can hide already-paired candidates. */
export type ExistingPair = {
  mentor_id: string;
  mentee_id: string;
  status: string;
};

export type ScoreContext = {
  /** The viewer profile (mentee or mentor looking for matches). For admin console, this is the selected mentee. */
  viewer: Profile;
  /** Pool to score against (other org profiles). */
  candidates: Profile[];
  /** Existing mentorship rows for hard-filter exclusions. */
  existingPairs?: ExistingPair[];
  /** Active mentorships per user, used for capacity awareness. */
  activeLoad?: Map<string, number>;
  /** Soft cap on a mentor's active mentees before they get a capacity penalty. */
  softCapacity?: number;
  /**
   * Force the viewer to be treated as a mentee (admin matching workflow).
   * If undefined, infer from the viewer's `is_mentor` / `is_mentee` flags.
   */
  viewerIsMentee?: boolean;
};

const PRACTICE_WEIGHT = 40;
const SENIORITY_WEIGHT = 25;
const JURISDICTION_WEIGHT = 15;
const LOCATION_WEIGHT = 10;
const AVAILABILITY_WEIGHT = 10;

function jaccard(a: string[] | null, b: string[] | null): { score: number; shared: string[] } {
  const A = new Set((a ?? []).filter(Boolean));
  const B = new Set((b ?? []).filter(Boolean));
  if (A.size === 0 || B.size === 0) return { score: 0, shared: [] };
  const shared = [...A].filter((x) => B.has(x));
  const union = new Set([...A, ...B]);
  return { score: shared.length / union.size, shared };
}

export function scoreMatches(ctx: ScoreContext): MatchResult[] {
  const {
    viewer,
    candidates,
    existingPairs = [],
    activeLoad,
    softCapacity = 3,
  } = ctx;

  // Treat "both roles" as permissive (neither strictly mentee nor mentor).
  const viewerIsMentee = ctx.viewerIsMentee ?? (viewer.is_mentee && !viewer.is_mentor);
  const viewerIsMentor = !viewerIsMentee && viewer.is_mentor && !viewer.is_mentee;

  // Build pair-exclusion set
  const blocked = new Set<string>();
  for (const p of existingPairs) {
    if (p.status !== "active") continue;
    if (p.mentor_id === viewer.user_id) blocked.add(p.mentee_id);
    if (p.mentee_id === viewer.user_id) blocked.add(p.mentor_id);
  }

  const out: MatchResult[] = [];

  for (const c of candidates) {
    if (c.user_id === viewer.user_id) continue;
    if (blocked.has(c.user_id)) continue;

    // Decide candidate role relative to viewer
    let candidateIsMentor: boolean;
    if (viewerIsMentee) {
      // Skip only if candidate is clearly mentee-only.
      if (c.is_mentee && !c.is_mentor) continue;
      if (c.is_mentor && c.accepting_mentees === false) {
        // explicit "not accepting" → skip; unset is fine
      }
      candidateIsMentor = true;
    } else if (viewerIsMentor) {
      // Skip only if candidate is clearly mentor-only.
      if (c.is_mentor && !c.is_mentee) continue;
      candidateIsMentor = false;
    } else {
      // Viewer is both or neither — be permissive but prefer mentors
      candidateIsMentor = !!c.is_mentor;
    }

    const reasons: MatchReason[] = [];
    let score = 0;

    // 1. Practice areas
    const { score: jac, shared } = jaccard(viewer.practice_areas, c.practice_areas);
    const practicePts = jac * PRACTICE_WEIGHT;
    score += practicePts;
    if (shared.length > 0) {
      reasons.push(
        shared.length === 1
          ? `Shared focus: ${shared[0]}`
          : `${shared.length} shared practice areas`,
      );
    }

    // 2. Seniority complementarity
    const mentorYrs = candidateIsMentor ? c.years_experience : viewer.years_experience;
    const menteeYrs = candidateIsMentor ? viewer.years_experience : c.years_experience;
    if (mentorYrs != null && menteeYrs != null) {
      const gap = mentorYrs - menteeYrs;
      let pts = 0;
      if (gap >= 5 && gap <= 20) pts = SENIORITY_WEIGHT;
      else if (gap > 20) pts = SENIORITY_WEIGHT * 0.7;
      else if (gap >= 2) pts = SENIORITY_WEIGHT * 0.5;
      else if (gap >= 0) pts = SENIORITY_WEIGHT * 0.2;
      // negative gap (mentor less senior than mentee) → 0
      score += pts;
      if (pts >= SENIORITY_WEIGHT * 0.5) {
        reasons.push(`${Math.abs(gap)} yrs ${candidateIsMentor ? "more" : "less"} experience`);
      }
    }

    // 3. Jurisdiction (state + bar admissions)
    let jurPts = 0;
    if (viewer.state && c.state && viewer.state === c.state) {
      jurPts += JURISDICTION_WEIGHT * 0.7;
      reasons.push(`Same state (${c.state})`);
    }
    const barShared = jaccard(viewer.bar_admissions ?? [], c.bar_admissions ?? []);
    if (barShared.shared.length > 0) {
      jurPts += JURISDICTION_WEIGHT * 0.3;
      reasons.push(`Shared bar admission`);
    }
    score += Math.min(JURISDICTION_WEIGHT, jurPts);

    // 4. Location proximity
    if (viewer.city && c.city && viewer.city === c.city) {
      score += LOCATION_WEIGHT;
      reasons.push(`Same city (${c.city})`);
    } else if (viewer.state && c.state && viewer.state === c.state) {
      score += LOCATION_WEIGHT * 0.5;
    }

    // 5. Availability signal
    if (candidateIsMentor && c.accepting_mentees) {
      score += AVAILABILITY_WEIGHT * 0.6;
      const cadence = c.meeting_cadence ?? null;
      if (cadence) {
        score += AVAILABILITY_WEIGHT * 0.4;
        reasons.push(`Available ${cadence}`);
      }
    }

    // Capacity penalty on mentor side
    if (candidateIsMentor && activeLoad) {
      const load = activeLoad.get(c.user_id) ?? 0;
      if (load >= softCapacity) {
        score *= 0.6;
        reasons.push(`At capacity (${load} mentees)`);
      } else if (load > 0) {
        reasons.push(`${load} active mentee${load === 1 ? "" : "s"}`);
      }
    }

    out.push({
      profile: c,
      score: Math.round(Math.max(0, Math.min(100, score))),
      reasons: reasons.slice(0, 4),
      candidateIsMentor,
    });
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}

export function buildActiveLoadMap(pairs: ExistingPair[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of pairs) {
    if (p.status !== "active") continue;
    m.set(p.mentor_id, (m.get(p.mentor_id) ?? 0) + 1);
  }
  return m;
}
