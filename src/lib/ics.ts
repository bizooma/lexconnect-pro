import { markdownToPlainText } from "@/components/events/EventMarkdown";

export type IcsEvent = {
  id: string;
  title: string;
  description?: string | null;
  location_name?: string | null;
  location_address?: string | null;
  is_virtual?: boolean;
  virtual_url?: string | null;
  starts_at: string;
  ends_at?: string | null;
};

function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function esc(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function fold(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 74));
  rest = rest.slice(74);
  while (rest.length) {
    parts.push(` ${rest.slice(0, 73)}`);
    rest = rest.slice(73);
  }
  return parts.join("\r\n");
}

export function eventToVevent(e: IcsEvent): string[] {
  const location = e.is_virtual
    ? e.virtual_url || "Virtual"
    : [e.location_name, e.location_address].filter(Boolean).join(", ") || "TBD";
  const end = e.ends_at || new Date(new Date(e.starts_at).getTime() + 60 * 60 * 1000).toISOString();
  return [
    "BEGIN:VEVENT",
    `UID:${e.id}`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(e.starts_at)}`,
    `DTEND:${icsDate(end)}`,
    fold(`SUMMARY:${esc(e.title)}`),
    fold(`LOCATION:${esc(location)}`),
    ...(e.description ? [fold(`DESCRIPTION:${esc(markdownToPlainText(e.description))}`)] : []),
    "END:VEVENT",
  ];
}

export function buildIcs(events: IcsEvent[], calendarName?: string): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LexGuild//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...(calendarName ? [fold(`X-WR-CALNAME:${esc(calendarName)}`)] : []),
    ...events.flatMap(eventToVevent),
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Client-side download of a single event .ics. */
export function downloadEventIcs(e: IcsEvent) {
  const blob = new Blob([buildIcs([e])], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(e.title || "event").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
