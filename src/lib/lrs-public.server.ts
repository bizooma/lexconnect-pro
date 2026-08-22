import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** True when the org runs a public lawyer-referral service (approved, active panelists). */
export async function orgHasReferralService(orgId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("referral_panel")
    .select("id")
    .eq("organization_id", orgId)
    .eq("application_status", "approved")
    .eq("is_active", true)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/**
 * Public chrome + config for the consumer lawyer-referral intake page.
 * Custom disclaimer text is read from website_brand_settings.contact_info.referral_disclaimer.
 */
export async function loadPublicReferralIntakePage(orgSlug: string) {
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id,name,slug,logo_url,paused")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (!org) throw new Error("Not found");

  const [brandRes, navRes, sponsorRes, eventRes] = await Promise.all([
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
      .from("org_events")
      .select("id")
      .eq("organization_id", org.id)
      .eq("status", "published")
      .eq("visibility", "public")
      .limit(1),
  ]);

  const contact = (brandRes.data?.contact_info ?? {}) as Record<string, unknown>;
  const custom = typeof contact["referral_disclaimer"] === "string" ? (contact["referral_disclaimer"] as string) : null;

  return {
    organization: { id: org.id, name: org.name, slug: org.slug, logo_url: org.logo_url },
    paused: !!org.paused,
    brand: brandRes.data ?? null,
    navPages: (navRes.data ?? []) as Array<{ id: string; title: string; slug: string; nav_order: number }>,
    hasSponsors: (sponsorRes.data?.length ?? 0) > 0,
    hasEvents: (eventRes.data?.length ?? 0) > 0,
    customDisclaimer: custom && custom.trim() ? custom.trim() : null,
  };
}
