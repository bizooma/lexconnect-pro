import { useEffect, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { recordSponsorEvent } from "@/lib/sponsors.functions";

export const Route = createFileRoute("/app/sponsors/$sponsorId")({
  head: () => ({
    meta: [
      { title: "Sponsor — LexGuild" },
      { name: "description", content: "Learn about this sponsor and the offer available to members." },
      { property: "og:title", content: "Sponsor — LexGuild" },
      { property: "og:description", content: "Learn about this sponsor and the offer available to members." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SponsorDetailPage,
});

type SponsorDetail = {
  id: string;
  name: string;
  tier: string;
  category: string | null;
  blurb: string | null;
  offer: string | null;
  logo_url: string | null;
  image_urls: string[];
  website_url: string | null;
  video_provider: string | null;
  video_id: string | null;
};

function embedUrl(provider: string | null, id: string | null): string | null {
  if (!id || !/^[A-Za-z0-9_-]{1,40}$/.test(id)) return null;
  if (provider === "youtube") return `https://www.youtube-nocookie.com/embed/${id}`;
  if (provider === "vimeo") return `https://player.vimeo.com/video/${id}`;
  return null;
}

function SponsorDetailPage() {
  const { sponsorId } = useParams({ from: "/app/sponsors/$sponsorId" });
  const { currentOrg } = useCurrentOrg();
  const [sponsor, setSponsor] = useState<SponsorDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("org_sponsors")
        .select("id, name, tier, category, blurb, offer, logo_url, image_urls, website_url, video_provider, video_id")
        .eq("id", sponsorId)
        .eq("status", "active")
        .maybeSingle();
      if (cancelled) return;
      setSponsor((data as SponsorDetail | null) ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sponsorId]);

  useEffect(() => {
    if (!sponsor) return;
    void recordSponsorEvent({ data: { sponsorId: sponsor.id, event: "view" } }).catch(() => {});
  }, [sponsor?.id]);

  const onVisit = async () => {
    if (!sponsor?.website_url) return;
    try {
      await recordSponsorEvent({ data: { sponsorId: sponsor.id, event: "click" } });
    } catch {
      /* tracking is best-effort */
    }
    window.open(sponsor.website_url, "_blank", "noopener,noreferrer");
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading sponsor…</div>;

  if (!sponsor) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 p-6">
        <h1 className="text-xl font-semibold">Sponsor not available</h1>
        <p className="text-sm text-muted-foreground">This sponsor is no longer listed.</p>
        <Link to="/app/sponsors" className="text-sm text-primary underline">Back to sponsors</Link>
      </div>
    );
  }

  const video = embedUrl(sponsor.video_provider, sponsor.video_id);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <Link to="/app/sponsors" className="text-sm text-muted-foreground hover:underline">← All sponsors</Link>

      <header className="flex flex-wrap items-center gap-4">
        {sponsor.logo_url && (
          <img src={sponsor.logo_url} alt={`${sponsor.name} logo`} className="max-h-20 max-w-[200px] object-contain" />
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{sponsor.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[sponsor.category, `${sponsor.tier} sponsor of ${currentOrg?.name ?? "our organization"}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </header>

      {sponsor.offer && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">Member offer</p>
          <p className="mt-1 text-sm">{sponsor.offer}</p>
        </div>
      )}

      {sponsor.blurb && <p className="whitespace-pre-wrap text-sm leading-relaxed">{sponsor.blurb}</p>}

      {video && (
        <div className="aspect-video w-full overflow-hidden rounded-lg border">
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

      {sponsor.image_urls?.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {sponsor.image_urls.map((url) => (
            <img
              key={url}
              src={url}
              alt={`${sponsor.name} gallery image`}
              loading="lazy"
              className="h-32 w-full rounded-lg border object-cover"
            />
          ))}
        </div>
      )}

      {sponsor.website_url && (
        <Button onClick={onVisit}>Visit website</Button>
      )}
    </div>
  );
}
