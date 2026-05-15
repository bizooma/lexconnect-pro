// Lightweight client-side diff utilities for the publish-history viewer.
// No external deps: line-based LCS for text fields and a stable section
// diff that classifies each section as added / removed / changed / equal.

import { SECTION_LABELS, type WebsiteSectionType } from "@/lib/website";

export type LineDiff = { type: "equal" | "add" | "remove"; text: string };

function splitLines(s: string): string[] {
  return (s ?? "").replace(/\r\n/g, "\n").split("\n");
}

/** Standard LCS-based line diff. Returns aligned add/remove/equal rows. */
export function diffLines(a: string, b: string): LineDiff[] {
  const A = splitLines(a);
  const B = splitLines(b);
  const m = A.length;
  const n = B.length;
  // LCS length table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: LineDiff[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (A[i] === B[j]) {
      out.push({ type: "equal", text: A[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "remove", text: A[i] });
      i++;
    } else {
      out.push({ type: "add", text: B[j] });
      j++;
    }
  }
  while (i < m) out.push({ type: "remove", text: A[i++] });
  while (j < n) out.push({ type: "add", text: B[j++] });
  return out;
}

/** Aligns two diffs into side-by-side rows so the left/right columns line up. */
export type SideRow = { left: string | null; right: string | null; type: "equal" | "add" | "remove" | "change" };

export function alignSideBySide(diff: LineDiff[]): SideRow[] {
  const rows: SideRow[] = [];
  let i = 0;
  while (i < diff.length) {
    const d = diff[i];
    if (d.type === "equal") {
      rows.push({ left: d.text, right: d.text, type: "equal" });
      i++;
      continue;
    }
    // Pair consecutive remove+add as a "change" row.
    if (d.type === "remove" && i + 1 < diff.length && diff[i + 1].type === "add") {
      rows.push({ left: d.text, right: diff[i + 1].text, type: "change" });
      i += 2;
      continue;
    }
    if (d.type === "remove") {
      rows.push({ left: d.text, right: null, type: "remove" });
      i++;
      continue;
    }
    rows.push({ left: null, right: d.text, type: "add" });
    i++;
  }
  return rows;
}

// ---------- Section-level diff ----------

export type SectionLike = {
  id?: string;
  section_type: WebsiteSectionType | string;
  display_order?: number;
  settings_json?: unknown;
  content_json?: unknown;
  visible?: boolean;
};

export type SectionDiffEntry = {
  key: string;
  type: "equal" | "added" | "removed" | "changed" | "moved";
  label: string;
  left: SectionLike | null;
  right: SectionLike | null;
  leftIndex: number | null;
  rightIndex: number | null;
};

function stableHash(v: unknown): string {
  const seen = new WeakSet();
  const sort = (x: unknown): unknown => {
    if (x && typeof x === "object") {
      if (seen.has(x as object)) return null;
      seen.add(x as object);
      if (Array.isArray(x)) return x.map(sort);
      const o = x as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(o).sort()) out[k] = sort(o[k]);
      return out;
    }
    return x;
  };
  try {
    return JSON.stringify(sort(v));
  } catch {
    return "";
  }
}

function sectionLabel(s: SectionLike): string {
  return SECTION_LABELS[s.section_type as WebsiteSectionType] ?? String(s.section_type);
}

/** Diff two section arrays. Pairs by id when present, otherwise by index. */
export function diffSections(left: SectionLike[], right: SectionLike[]): SectionDiffEntry[] {
  const out: SectionDiffEntry[] = [];
  const usedRight = new Set<number>();
  const rightById = new Map<string, number>();
  right.forEach((s, idx) => {
    if (s.id) rightById.set(s.id, idx);
  });

  left.forEach((l, li) => {
    let ri = -1;
    if (l.id && rightById.has(l.id)) {
      ri = rightById.get(l.id)!;
    } else {
      // fall back to same index when id is missing
      if (li < right.length && !usedRight.has(li) && right[li].section_type === l.section_type) ri = li;
    }
    if (ri === -1) {
      out.push({
        key: `L-${li}`,
        type: "removed",
        label: sectionLabel(l),
        left: l,
        right: null,
        leftIndex: li,
        rightIndex: null,
      });
      return;
    }
    usedRight.add(ri);
    const r = right[ri];
    const equal = stableHash({ t: l.section_type, s: l.settings_json, c: l.content_json, v: l.visible }) ===
      stableHash({ t: r.section_type, s: r.settings_json, c: r.content_json, v: r.visible });
    const moved = ri !== li;
    out.push({
      key: l.id ?? `L-${li}`,
      type: equal ? (moved ? "moved" : "equal") : "changed",
      label: sectionLabel(l),
      left: l,
      right: r,
      leftIndex: li,
      rightIndex: ri,
    });
  });

  right.forEach((r, ri) => {
    if (usedRight.has(ri)) return;
    out.push({
      key: r.id ?? `R-${ri}`,
      type: "added",
      label: sectionLabel(r),
      left: null,
      right: r,
      leftIndex: null,
      rightIndex: ri,
    });
  });

  return out;
}

/** Renders a section as readable plaintext for line-diffing its contents. */
export function sectionToText(s: SectionLike | null): string {
  if (!s) return "";
  const lines: string[] = [];
  lines.push(`type: ${s.section_type}`);
  if (typeof s.visible === "boolean") lines.push(`visible: ${s.visible}`);
  const flatten = (prefix: string, v: unknown) => {
    if (v == null) return;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      lines.push(`${prefix}: ${String(v)}`);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((item, i) => flatten(`${prefix}[${i}]`, item));
      return;
    }
    if (typeof v === "object") {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        flatten(prefix ? `${prefix}.${k}` : k, val);
      }
    }
  };
  flatten("settings", s.settings_json);
  flatten("content", s.content_json);
  return lines.join("\n");
}
