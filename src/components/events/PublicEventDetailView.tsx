import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicSponsorShell } from "@/components/website/PublicSponsorShell";
import { SiteBaseProvider, siteHref, useSiteBase } from "@/components/website/site-base";
import { EventMarkdown, markdownToPlainText } from "@/components/events/EventMarkdown";
import { AddToCalendarButton, EventTimes } from "@/components/events/PublicEventsView";
import type { PublicEvent } from "@/lib/events-public.server";

function RsvpForm({ event }: { event: PublicEvent }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(""); // honeypot — humans never fill this
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"going" | "waitlist" | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (company.trim()) {
      setDone("going"); // silently drop bot submissions
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("rsvp_to_event", {
      _event_id: event.id,
      _guest_name: name.trim(),
      _guest_email: email.trim(),
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    const status = (data as { status?: string } | null)?.status;
    setDone(status === "waitlist" ? "waitlist" : "going");
  };

  if (done) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm">
        {done === "waitlist"
          ? "You're on the waitlist — we'll email you if a spot opens up."
          : "You're registered. See you there!"}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="font-medium">Register for this event</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Name</span>
          <input
            required
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Company
          <input tabIndex={-1} autoComplete="off" value={company} onChange={(ev) => setCompany(ev.target.value)} />
        </label>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
      >
        {busy ? "Submitting…" : "RSVP"}
      </button>
    </form>
  );
}

function EventDetail({ event }: { event: PublicEvent }) {
  const base = useSiteBase();
  const cancelled = event.status === "cancelled";
  return (
    <article className="space-y-6">
      <a href={siteHref(base, "/events")} className="text-sm text-muted-foreground hover:text-foreground">
        ← All events
      </a>
      {event.cover_image_url && (
        <img src={event.cover_image_url} alt={`${event.title} cover`} className="w-full rounded-lg object-cover" />
      )}
      <div>
        <h1 className="text-3xl font-semibold">{event.title}</h1>
        <div className="mt-2">
          <EventTimes event={event} />
        </div>
      </div>

      {cancelled && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">This event has been cancelled.</p>
      )}

      <div className="text-sm text-muted-foreground">
        {event.is_virtual ? (
          event.virtual_url ? (
            <p>
              Virtual event — join link:{" "}
              <a className="text-primary underline" href={event.virtual_url} target="_blank" rel="noopener noreferrer">
                {event.virtual_url}
              </a>
            </p>
          ) : (
            <p>Virtual event — join link to follow.</p>
          )
        ) : (
          <p>
            {event.location_name || "Location TBD"}
            {event.location_address ? ` · ${event.location_address}` : ""}
          </p>
        )}
      </div>

      <AddToCalendarButton event={event} />

      {event.description && <EventMarkdown text={event.description} className="space-y-3 leading-relaxed" />}

      {!cancelled && event.rsvp_enabled && <RsvpForm event={event} />}
    </article>
  );
}

export function PublicEventDetailPage({
  organization,
  brand,
  navPages,
  hasSponsors,
  event,
  basePath,
}: {
  organization: { id: string; name: string; slug: string; logo_url: string | null };
  brand: any | null;
  navPages: Array<{ id: string; title: string; slug: string; nav_order: number }>;
  hasSponsors: boolean;
  event: PublicEvent;
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
        currentSlug="events"
      >
        <EventDetail event={event} />
      </PublicSponsorShell>
    </SiteBaseProvider>
  );
}

export function publicEventMeta(orgName: string, event: PublicEvent) {
  const title = `${event.title} — ${orgName}`;
  const description =
    markdownToPlainText(event.description, 160) || `${event.title}, hosted by ${orgName}.`;
  const img = event.cover_image_url;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      ...(img ? [{ property: "og:image", content: img }, { name: "twitter:image", content: img }] : []),
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: img ? "summary_large_image" : "summary" },
    ],
  };
}
