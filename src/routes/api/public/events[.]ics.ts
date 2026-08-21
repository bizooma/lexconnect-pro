import { createFileRoute } from "@tanstack/react-router";
import { loadPublicEventsFeed } from "@/lib/events-public.server";
import { resolveSiteHostTarget } from "@/lib/website-host-resolve.server";
import { buildIcs } from "@/lib/ics";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,119}$/;

/** Public iCal feed of an org's published public events. */
export const Route = createFileRoute("/api/public/events.ics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const qsOrg = new URL(request.url).searchParams.get("org");
        let orgSlug: string | null = qsOrg && SLUG_RE.test(qsOrg) ? qsOrg : null;
        if (!orgSlug) {
          const target = await resolveSiteHostTarget();
          orgSlug = target?.orgSlug ?? null;
        }
        if (!orgSlug) return new Response("Not found", { status: 404 });

        const feed = await loadPublicEventsFeed(orgSlug);
        if (!feed) return new Response("Not found", { status: 404 });

        return new Response(buildIcs(feed.events, `${feed.name} Events`), {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'inline; filename="events.ics"',
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
