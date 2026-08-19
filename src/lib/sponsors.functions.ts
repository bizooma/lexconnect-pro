import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rateLimit } from "@/lib/rate-limit";

/**
 * PUBLIC endpoint — anonymous sponsor impression/click counter.
 * Stores nothing but a per-sponsor, per-day counter. No IPs, user ids,
 * or user agents are persisted; the IP is used only for in-memory throttling.
 */
export const recordSponsorEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        sponsorId: z.string().uuid(),
        event: z.enum(["view", "click"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    let ip = "unknown";
    try {
      ip =
        getRequestHeader("cf-connecting-ip") ||
        getRequestHeader("x-real-ip") ||
        (getRequestHeader("x-forwarded-for") || "").split(",")[0].trim() ||
        "unknown";
    } catch {
      // ignore — SSR context may not have headers
    }
    const rl = rateLimit(`sp:${ip}:${data.sponsorId}`, { limit: 30, windowMs: 60_000 });
    if (!rl.allowed) return { ok: false, throttled: true };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: sponsor } = await supabaseAdmin
      .from("org_sponsors")
      .select("id, organization_id")
      .eq("id", data.sponsorId)
      .maybeSingle();
    if (!sponsor) return { ok: false, ignored: true };

    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabaseAdmin
      .from("org_sponsor_metrics")
      .select("views, clicks")
      .eq("sponsor_id", sponsor.id)
      .eq("day", today)
      .maybeSingle();

    const views = (existing?.views ?? 0) + (data.event === "view" ? 1 : 0);
    const clicks = (existing?.clicks ?? 0) + (data.event === "click" ? 1 : 0);

    const { error } = await supabaseAdmin
      .from("org_sponsor_metrics")
      .upsert(
        {
          sponsor_id: sponsor.id,
          organization_id: sponsor.organization_id,
          day: today,
          views,
          clicks,
        },
        { onConflict: "sponsor_id,day" },
      );
    if (error) return { ok: false, ignored: true };
    return { ok: true };
  });

export type SponsorVideo = { provider: "youtube" | "vimeo"; videoId: string };

function parseVideo(url: string): SponsorVideo | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const idOk = (v: string) => /^[A-Za-z0-9_-]{5,20}$/.test(v);

  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const v = u.searchParams.get("v") ?? "";
    if (u.pathname === "/watch" && idOk(v)) return { provider: "youtube", videoId: v };
    const shorts = u.pathname.match(/^\/(?:shorts|embed)\/([A-Za-z0-9_-]{5,20})$/);
    if (shorts) return { provider: "youtube", videoId: shorts[1] };
    return null;
  }
  if (host === "youtu.be") {
    const id = u.pathname.replace(/^\//, "");
    return idOk(id) ? { provider: "youtube", videoId: id } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/(?:^|\/)(\d{5,20})(?:$|\/)/);
    if (m && idOk(m[1])) return { provider: "vimeo", videoId: m[1] };
    return null;
  }
  return null;
}

/** Admin-only: validate a YouTube/Vimeo URL and return provider + id. Raw URL is never stored. */
export const parseSponsorVideoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ url: z.string().min(1).max(500) }).parse(input),
  )
  .handler(async ({ data }) => {
    const parsed = parseVideo(data.url);
    if (!parsed) {
      throw new Error("Enter a valid YouTube or Vimeo video URL");
    }
    return parsed;
  });
