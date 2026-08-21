// Timezone helpers for the Events module (no external deps).

export const DEFAULT_TZ = "America/New_York";

export const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Mexico_City",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];

export function allTimezones(): string[] {
  try {
    const anyIntl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
    const list = anyIntl.supportedValuesOf?.("timeZone");
    if (list && list.length) return list;
  } catch {
    // fall through
  }
  return COMMON_TIMEZONES;
}

function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === "24" ? "0" : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUTC - date.getTime();
}

/** "2026-08-21T18:30" interpreted in `timeZone` -> ISO UTC string. */
export function zonedLocalToUtcISO(local: string, timeZone: string): string | null {
  if (!local) return null;
  const [d, t = "00:00"] = local.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  const guess = Date.UTC(y, (m ?? 1) - 1, day ?? 1, hh ?? 0, mm ?? 0, 0);
  let ts = guess - tzOffsetMs(new Date(guess), timeZone);
  // refine once for DST boundaries
  ts = guess - tzOffsetMs(new Date(ts), timeZone);
  return new Date(ts).toISOString();
}

/** ISO UTC -> "2026-08-21T18:30" wall time in `timeZone`. */
export function utcISOToZonedLocal(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  const off = tzOffsetMs(date, timeZone);
  const shifted = new Date(date.getTime() + off);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate(),
  )}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

export function formatInTz(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString("en-US", { timeZone });
  }
}
