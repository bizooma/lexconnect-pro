import { useEffect } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getPublicSponsors } from "@/lib/sponsors-public.functions";
import { recordSponsorEvent } from "@/lib/sponsors.functions";
import { PublicSponsorShell, sponsorEmbedUrl } from "@/components/website/PublicSponsorShell";

export const Route = createFileRoute("/p/$orgSlug/sponsors/$sponsorId")({
  loader: async ({ params }) => {
    let payload;
    try {
      payload = await getPublicSponsors({ data: { orgSlug: params.orgSlug } });
    } catch {
      throw notFound();
    }
    const sponsor = payload.sponsors.find((s) => s.id === params.sponsorId);
    if (!sponsor) throw notFound();
    return { organization: payload.organization, brand: payload.brand, sponsor, navPages: payload.navPages };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Sponsor" }, { name: "robots", content: "noindex" }] };
    const title = `${loaderData.sponsor.name} — ${loaderData.organization.name} Sponsors`;
    const description =
      loaderData.sponsor.blurb?.slice(0, 155) ||
      `${loaderData.sponsor.name} proudly supports ${loaderData.organization.name}.`;
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
  },
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <h1 className="text-3xl font-semibold">Sponsor not found</h1>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <h1 className="text-3xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
  component: PublicSponsorDetail,
});

function PublicSponsorDetail() {
  const { organization, brand, sponsor, navPages } = Route.useLoaderData();

  useEffect(() => {
    void recordSponsorEvent({ data: { sponsorId: sponsor.id, event: "view" } }).catch(() => {});
  }, [sponsor.id]);

  const onVisit = async () => {
    if (!sponsor.website_url) return;
    try {
      await recordSponsorEvent({ data: { sponsorId: sponsor.id, event: "click" } });
    } catch {
      /* best-effort */
    }
    window.open(sponsor.website_url, "_blank", "noopener,noreferrer");
  };

  const video = sponsorEmbedUrl(sponsor.video_provider, sponsor.video_id);

  return (
    <PublicSponsorShell organization={organization} brand={brand} navPages={navPages}>
      <Link
        to="/p/$orgSlug/sponsors"
        params={{ orgSlug: organization.slug }}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← All sponsors
      </Link>

      <header className="mt-4 flex flex-wrap items-center gap-4">
        {sponsor.logo_url && (
          <img src={sponsor.logo_url} alt={`${sponsor.name} logo`} className="max-h-20 max-w-[200px] object-contain" />
        )}
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{sponsor.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[sponsor.category, `${sponsor.tier} sponsor of ${organization.name}`].filter(Boolean).join(" · ")}
          </p>
        </div>
      </header>

      {sponsor.offer && (
        <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">Offer</p>
          <p className="mt-1 text-sm">{sponsor.offer}</p>
        </div>
      )}

      {sponsor.blurb && <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed">{sponsor.blurb}</p>}

      {video && (
        <div className="mt-6 aspect-video w-full overflow-hidden rounded-lg border border-border">
          <iframe
            src={video}
            title={`${sponsor.name} video`}
            className="h-full w-full"
            allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      )}

      {sponsor.image_urls && sponsor.image_urls.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {sponsor.image_urls.map((url) => (
            <img
              key={url}
              src={url}
              alt={`${sponsor.name} gallery image`}
              loading="lazy"
              className="h-36 w-full rounded-lg border border-border object-cover"
            />
          ))}
        </div>
      )}

      {sponsor.website_url && (
        <button
          type="button"
          onClick={onVisit}
          className="mt-8 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Visit website
        </button>
      )}
    </PublicSponsorShell>
  );
}
