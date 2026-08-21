import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getEffectiveHost } from "@/lib/website-host.server";

// Hosts that are never a tenant custom domain.
const RESERVED_HOST_SUFFIXES = ["lexguild.com", "lovable.app", "lovable.dev", "localhost"];

const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/**
 * Resolves the inbound Host header to a verified SITE-mode tenant domain.
 * Returns the org slug and the domain's default page slug, or null.
 */
export async function resolveSiteHostTarget(): Promise<
  { orgSlug: string; defaultSlug: string } | null
> {
  const host = getEffectiveHost();
  if (!host) return null;
  if (RESERVED_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))) return null;
  if (!HOST_RE.test(host)) return null;
  const bare = host.replace(/^www\./, "");
  const { data: row } = await supabaseAdmin
    .from("website_custom_domains")
    .select("organization_id, default_page_slug, mode")
    .or(`domain.eq.${host},domain.eq.${bare},domain.eq.www.${bare}`)
    .not("verified_at", "is", null)
    .maybeSingle();
  if (!row || row.mode !== "site") return null;
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("slug")
    .eq("id", row.organization_id)
    .maybeSingle();
  if (!org?.slug) return null;
  return { orgSlug: org.slug, defaultSlug: row.default_page_slug || "home" };
}
