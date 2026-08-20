import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Invalid slug");

export type PublicSponsor = {
  id: string;
  name: string;
  tier: string;
  tier_rank: number;
  category: string | null;
  blurb: string | null;
  offer: string | null;
  logo_url: string | null;
  image_urls: string[] | null;
  website_url: string | null;
  video_provider: string | null;
  video_id: string | null;
};

/**
 * Public sponsor directory for a tenant.
 * Sponsor data comes ONLY from the anon-callable definer function
 * `get_public_sponsors`, via a publishable-key (anon) client.
 * Branding (org name/logo/accent) is read the same way every other public
 * /p page reads it, so the page matches the rest of the public site.
 */
export const getPublicSponsors = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ orgSlug: slugSchema }).parse(input))
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabasePublic = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: rpc, error } = await supabasePublic.rpc("get_public_sponsors", {
      _org_slug: data.orgSlug,
    });
    if (error) throw new Error(error.message);
    const sponsors = (Array.isArray(rpc) ? rpc : []) as unknown as PublicSponsor[];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id,name,slug,logo_url,paused")
      .eq("slug", data.orgSlug)
      .maybeSingle();
    if (!org || org.paused) throw new Error("Not found");
    const { data: brand } = await supabaseAdmin
      .from("website_brand_settings")
      .select("*")
      .eq("organization_id", org.id)
      .maybeSingle();

    const { data: navPages } = await supabaseAdmin
      .from("website_pages")
      .select("id,title,slug,nav_order")
      .eq("organization_id", org.id)
      .eq("status", "published")
      .eq("show_in_nav", true)
      .order("nav_order", { ascending: true })
      .order("title", { ascending: true });

    return {
      organization: { id: org.id, name: org.name, slug: org.slug, logo_url: org.logo_url },
      brand: brand ?? null,
      sponsors,
      navPages: (navPages ?? []) as Array<{ id: string; title: string; slug: string; nav_order: number }>,
    };
  });
