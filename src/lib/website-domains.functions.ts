import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const domainSchema = z
  .string()
  .min(3)
  .max(253)
  .toLowerCase()
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, "Invalid domain");

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
    const patch: Record<string, unknown> = {};
    if (data.defaultPageSlug !== undefined) patch.default_page_slug = data.defaultPageSlug;
    if (data.isPrimary !== undefined) patch.is_primary = data.isPrimary;
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
    z.object({ host: z.string().min(3).max(253).toLowerCase() }).parse(input),
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
