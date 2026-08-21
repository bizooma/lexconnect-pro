import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Loads a PUBLISHED tenant page plus branding/nav. Throws "Page not found"
 * for missing orgs, paused orgs, or unpublished/unknown slugs.
 */
export async function loadPublicPage(orgSlug: string, slug: string) {
  const { data: org, error: orgErr } = await supabaseAdmin
    .from("organizations")
    .select("id,name,slug,logo_url,paused")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (orgErr) throw new Error(orgErr.message);
  if (!org || org.paused) throw new Error("Page not found");

  const { data: page, error: pageErr } = await supabaseAdmin
    .from("website_pages")
    .select("*")
    .eq("organization_id", org.id)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (pageErr) throw new Error(pageErr.message);
  if (!page) throw new Error("Page not found");

  const [sectionsRes, brandRes, navRes, sponsorRes] = await Promise.all([
    supabaseAdmin
      .from("website_sections")
      .select("*")
      .eq("page_id", page.id)
      .eq("visible", true)
      .order("display_order", { ascending: true }),
    supabaseAdmin
      .from("website_brand_settings")
      .select("*")
      .eq("organization_id", org.id)
      .maybeSingle(),
    supabaseAdmin
      .from("website_pages")
      .select("id,title,slug,nav_order")
      .eq("organization_id", org.id)
      .eq("status", "published")
      .eq("show_in_nav", true)
      .order("nav_order", { ascending: true })
      .order("title", { ascending: true }),
    supabaseAdmin
      .from("org_sponsors")
      .select("id")
      .eq("organization_id", org.id)
      .eq("status", "active")
      .limit(1),
  ]);
  if (sectionsRes.error) throw new Error(sectionsRes.error.message);
  if (brandRes.error) throw new Error(brandRes.error.message);

  return {
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logo_url: org.logo_url,
    },
    page,
    sections: sectionsRes.data ?? [],
    brand: brandRes.data ?? null,
    navPages: (navRes.data ?? []) as Array<{ id: string; title: string; slug: string; nav_order: number }>,
    hasSponsors: (sponsorRes.data?.length ?? 0) > 0,
  };
}
