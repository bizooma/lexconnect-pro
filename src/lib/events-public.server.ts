import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

export type PublicEvent = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  location_name: string | null;
  location_address: string | null;
  is_virtual: boolean;
  virtual_url: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  cover_image_url: string | null;
  rsvp_enabled?: boolean;
  capacity?: number | null;
  status?: string;
};

/** Anon (publishable-key) client — public data comes only from definer RPCs. */
function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
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
}

async function loadOrgChrome(orgSlug: string) {
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id,name,slug,logo_url,paused")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (!org || org.paused) throw new Error("Not found");

  const [brandRes, navRes, sponsorRes, referralRes] = await Promise.all([
    supabaseAdmin.from("website_brand_settings").select("*").eq("organization_id", org.id).maybeSingle(),
    supabaseAdmin
      .from("website_pages")
      .select("id,title,slug,nav_order")
      .eq("organization_id", org.id)
      .eq("status", "published")
      .eq("show_in_nav", true)
      .order("nav_order", { ascending: true })
      .order("title", { ascending: true }),
    supabaseAdmin.from("org_sponsors").select("id").eq("organization_id", org.id).eq("status", "active").limit(1),
    supabaseAdmin
      .from("referral_panel")
      .select("id")
      .eq("organization_id", org.id)
      .eq("application_status", "approved")
      .eq("is_active", true)
      .limit(1),
  ]);

  return {
    organization: { id: org.id, name: org.name, slug: org.slug, logo_url: org.logo_url },
    brand: brandRes.data ?? null,
    navPages: (navRes.data ?? []) as Array<{ id: string; title: string; slug: string; nav_order: number }>,
    hasSponsors: (sponsorRes.data?.length ?? 0) > 0,
    hasReferralService: (referralRes.data?.length ?? 0) > 0,
  };
}

export async function fetchPublicEvents(orgId: string): Promise<PublicEvent[]> {
  const { data, error } = await publicClient().rpc("get_public_events", { _org_id: orgId });
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []) as unknown as PublicEvent[];
}

/** Extra display flags the definer fn doesn't return (never widens visibility). */
async function eventFlags(orgId: string, ids: string[]) {
  if (!ids.length) return {} as Record<string, { rsvp_enabled: boolean; capacity: number | null; status: string }>;
  const { data } = await supabaseAdmin
    .from("org_events")
    .select("id,rsvp_enabled,capacity,status")
    .eq("organization_id", orgId)
    .in("id", ids);
  const map: Record<string, { rsvp_enabled: boolean; capacity: number | null; status: string }> = {};
  for (const r of data ?? []) map[r.id] = { rsvp_enabled: r.rsvp_enabled, capacity: r.capacity, status: r.status };
  return map;
}

export async function loadPublicEventsPage(orgSlug: string) {
  const chrome = await loadOrgChrome(orgSlug);
  const events = await fetchPublicEvents(chrome.organization.id);
  const flags = await eventFlags(chrome.organization.id, events.map((e) => e.id));
  return {
    ...chrome,
    hasEvents: events.length > 0,
    events: events.map((e) => ({ ...e, ...(flags[e.id] ?? {}) })),
  };
}

export async function loadPublicEventDetail(orgSlug: string, slug: string) {
  const chrome = await loadOrgChrome(orgSlug);
  const { data, error } = await publicClient().rpc("get_public_event", {
    _org_id: chrome.organization.id,
    _slug: slug,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Not found");
  const event = data as unknown as PublicEvent;
  const flags = await eventFlags(chrome.organization.id, [event.id]);
  return { ...chrome, hasEvents: true, event: { ...event, ...(flags[event.id] ?? {}) } };
}

export async function loadPublicEventsFeed(orgSlug: string) {
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id,name,paused")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (!org || org.paused) return null;
  return { name: org.name, events: await fetchPublicEvents(org.id) };
}
