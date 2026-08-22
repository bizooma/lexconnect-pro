import { useMemo } from "react";
import { PublicSponsorShell } from "@/components/website/PublicSponsorShell";
import { SiteBaseProvider, siteHref, useSiteBase } from "@/components/website/site-base";
import { formatInTz } from "@/lib/event-time";
import { downloadEventIcs } from "@/lib/ics";
import type { PublicEvent } from "@/lib/events-public.server";

export function viewerTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function EventTimes({ event }: { event: PublicEvent }) {
  const local = viewerTz();
  const showLocal = local && local !== event.timezone;
  return (
    <div className="text-sm text-muted-foreground">
      <p>
        {formatInTz(event.starts_at, event.timezone)}
        {event.ends_at ? ` – ${formatInTz(event.ends_at, event.timezone)}` : ""}
      </p>
      {showLocal && (
        <p className="text-xs">
          Your time: {formatInTz(event.starts_at, local)}
          {event.ends_at ? ` – ${formatInTz(event.ends_at, local)}` : ""}
        </p>
      )}
    </div>
  );
}

export function AddToCalendarButton({ event }: { event: PublicEvent }) {
  return (
    <button
      type="button"
      onClick={() => downloadEventIcs(event)}
      className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
    >
      Add to calendar
    </button>
  );
}

function EventsList({
  organization,
  events,
}: {
  organization: { slug: string };
  events: PublicEvent[];
}) {
  const base = useSiteBase();
  const now = Date.now();

  const { upcoming, past } = useMemo(() => {
    const sorted = [...events].sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
    return {
      upcoming: sorted.filter((e) => +new Date(e.starts_at) >= now),
      past: sorted.filter((e) => +new Date(e.starts_at) < now).reverse(),
    };
  }, [events, now]);

  const groups = useMemo(() => {
    const out: { label: string; rows: PublicEvent[] }[] = [];
    for (const e of upcoming) {
      const label = new Intl.DateTimeFormat("en-US", {
        timeZone: e.timezone,
        month: "long",
        year: "numeric",
      }).format(new Date(e.starts_at));
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push(e);
      else out.push({ label, rows: [e] });
    }
    return out;
  }, [upcoming]);

  const feedUrl = base ? `/api/public/events.ics?org=${organization.slug}` : "/api/public/events.ics";

  const card = (e: PublicEvent) => (
    <article key={e.id} className="overflow-hidden rounded-lg border border-border bg-card">
      {e.cover_image_url && (
        <img src={e.cover_image_url} alt={`${e.title} cover`} loading="lazy" className="h-44 w-full object-cover" />
      )}
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium">
            {e.slug ? (
              <a href={siteHref(base, `/events/${e.slug}`)} className="hover:underline">
                {e.title}
              </a>
            ) : (
              e.title
            )}
          </h3>
          <div className="mt-1">
            <EventTimes event={e} />
          </div>
          <p className="text-sm text-muted-foreground">
            {e.is_virtual ? "Virtual" : e.location_name || "Location TBD"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AddToCalendarButton event={e} />
          {e.slug && (
            <a
              href={siteHref(base, `/events/${e.slug}`)}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            >
              Details
            </a>
          )}
        </div>
      </div>
    </article>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Events</h1>
          <p className="mt-1 text-sm text-muted-foreground">Upcoming events open to the public.</p>
        </div>
        <a href={feedUrl} className="text-sm text-muted-foreground underline hover:text-foreground">
          Subscribe to the calendar feed (.ics)
        </a>
      </div>

      {groups.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          No upcoming events right now — check back soon.
        </p>
      )}

      {groups.map((g) => (
        <section key={g.label} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</h2>
          {g.rows.map(card)}
        </section>
      ))}

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Past events</h2>
          {past.map(card)}
        </section>
      )}
    </div>
  );
}

export function PublicEventsView({
  organization,
  brand,
  navPages,
  hasSponsors,
  hasReferralService = false,
  events,
  basePath,
}: {
  organization: { id: string; name: string; slug: string; logo_url: string | null };
  brand: any | null;
  navPages: Array<{ id: string; title: string; slug: string; nav_order: number }>;
  hasSponsors: boolean;
  hasReferralService?: boolean;
  events: PublicEvent[];
  basePath: string;
}) {
  return (
    <SiteBaseProvider basePath={basePath}>
      <PublicSponsorShell
        organization={organization}
        brand={brand}
        navPages={navPages}
        hasSponsors={hasSponsors}
        hasEvents
        hasReferralService={hasReferralService}
        currentSlug="events"
      >
        <EventsList organization={organization} events={events} />
      </PublicSponsorShell>
    </SiteBaseProvider>
  );
}

export function publicEventsMeta(orgName: string) {
  const title = `Events — ${orgName}`;
  const description = `Upcoming public events hosted by ${orgName}. See dates, locations, and register online.`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}
