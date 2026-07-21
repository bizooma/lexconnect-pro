import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Hosts that should NEVER be treated as a tenant custom domain.
const RESERVED_HOST_SUFFIXES = [
  "lexguild.com",
  "lovable.app",
  "lovable.dev",
  "localhost",
];

const domainSchema = z
  .string()
  .min(3)
  .max(253)
  .toLowerCase()
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, "Invalid domain");

const modeSchema = z.enum(["site", "portal"]);

export const listCustomDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("website_custom_domains")
      .select("*")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { domains: rows ?? [] };
  });

export const addCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        domain: domainSchema,
        defaultPageSlug: z.string().min(1).max(120).optional().nullable(),
        mode: modeSchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("website_custom_domains")
      .insert({
        organization_id: data.organizationId,
        domain: data.domain,
        default_page_slug: data.defaultPageSlug ?? null,
        mode: data.mode ?? "site",
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { domain: row };
  });

export const updateCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        defaultPageSlug: z.string().min(1).max(120).optional().nullable(),
        isPrimary: z.boolean().optional(),
        mode: modeSchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.isPrimary) {
      // Unset primary on siblings first
      const { data: target } = await context.supabase
        .from("website_custom_domains")
        .select("organization_id")
        .eq("id", data.id)
        .single();
      if (target) {
        await context.supabase
          .from("website_custom_domains")
          .update({ is_primary: false })
          .eq("organization_id", target.organization_id);
      }
    }
    const patch: { default_page_slug?: string | null; is_primary?: boolean; mode?: "site" | "portal" } = {};
    if (data.defaultPageSlug !== undefined) patch.default_page_slug = data.defaultPageSlug;
    if (data.isPrimary !== undefined) patch.is_primary = data.isPrimary;
    if (data.mode !== undefined) patch.mode = data.mode;
    const { data: row, error } = await context.supabase
      .from("website_custom_domains")
      .update(patch)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { domain: row };
  });

export const removeCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("website_custom_domains")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Verifies ownership by looking up a TXT record at _lovable-verify.<domain>
// containing the verification_token. Uses Cloudflare's DNS-over-HTTPS endpoint.
export const verifyCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("website_custom_domains")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error("Domain not found");

    const txtName = `_lovable-verify.${row.domain}`;
    let found = false;
    try {
      const res = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(txtName)}&type=TXT`,
        { headers: { accept: "application/dns-json" } },
      );
      const json = (await res.json()) as { Answer?: { data: string }[] };
      const records = (json.Answer ?? []).map((a) => a.data.replace(/^"|"$/g, ""));
      found = records.some((r) => r.includes(row.verification_token));
    } catch {
      found = false;
    }

    if (!found) {
      throw new Error(
        `TXT record not found at ${txtName}. Add a TXT record with value "${row.verification_token}" and try again. DNS changes can take up to a few minutes to propagate.`,
      );
    }

    const { data: updated, error: upErr } = await context.supabase
      .from("website_custom_domains")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", data.id)
      .select()
      .single();
    if (upErr) throw new Error(upErr.message);
    return { domain: updated };
  });

// Public — used by the host-aware public route to resolve an incoming Host
// header to an org + default page slug.
export const resolveDomain = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ host: domainSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const host = data.host.replace(/^www\./, "");
    const { data: row, error } = await supabaseAdmin
      .from("website_custom_domains")
      .select("organization_id, domain, default_page_slug, verified_at")
      .or(`domain.eq.${host},domain.eq.www.${host}`)
      .not("verified_at", "is", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { match: null as null | { orgSlug: string; slug: string } };

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("slug")
      .eq("id", row.organization_id)
      .single();
    if (!org) return { match: null };

    return {
      match: { orgSlug: org.slug, slug: row.default_page_slug || "home" },
    };
  });

// Server-only: reads the incoming Host header and returns a redirect target
// if it's a verified tenant domain. Returns null otherwise.
export const resolveCurrentHost = createServerFn({ method: "GET" }).handler(async () => {
  let host = "";
  try {
    host = (getRequestHost() || "").toLowerCase();
  } catch {
    return { redirectTo: null as string | null };
  }
  if (!host) return { redirectTo: null };
  // Strip port
  host = host.replace(/:\d+$/, "");
  if (RESERVED_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))) {
    return { redirectTo: null };
  }
  // Validate the raw Host with the strict domain schema before it enters a
  // PostgREST .or() filter — prevents commas/parens from perturbing the query.
  const hostParse = domainSchema.safeParse(host);
  if (!hostParse.success) return { redirectTo: null };
  const safeHost = hostParse.data;
  const bare = safeHost.replace(/^www\./, "");
  const { data: row } = await supabaseAdmin
    .from("website_custom_domains")
    .select("organization_id, default_page_slug")
    .or(`domain.eq.${safeHost},domain.eq.${bare},domain.eq.www.${bare}`)
    .not("verified_at", "is", null)
    .maybeSingle();
  if (!row) return { redirectTo: null };
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("slug")
    .eq("id", row.organization_id)
    .single();
  if (!org) return { redirectTo: null };
  return { redirectTo: `/p/${org.slug}/${row.default_page_slug || "home"}` };
});
