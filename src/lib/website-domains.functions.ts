import { createServerFn } from "@tanstack/react-start";
import { getRequestHost, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Returns the effective inbound host, preferring x-forwarded-host (the
// hosting proxy rewrites Host in production). Lowercased, port-stripped.
export function getEffectiveHost(): string {
  let xfh = "";
  try {
    xfh = getRequestHeader("x-forwarded-host") ?? "";
  } catch {
    xfh = "";
  }
  let host = "";
  if (xfh) {
    host = xfh.split(",")[0]?.trim() ?? "";
  }
  if (!host) {
    try {
      host = getRequestHost() || "";
    } catch {
      host = "";
    }
  }
  host = host.toLowerCase().replace(/:\d+$/, "");
  return host;
}

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
    const mode = data.mode ?? "site";
    if (mode === "portal") {
      const { data: entitled, error: entErr } = await context.supabase
        .rpc("has_white_label", { _org: data.organizationId });
      if (entErr) throw new Error(entErr.message);
      if (!entitled) {
        throw new Error(
          "Portal-mode domains require the white-label add-on. Upgrade your plan to enable branded member portals.",
        );
      }
    }
    const { data: row, error } = await context.supabase
      .from("website_custom_domains")
      .insert({
        organization_id: data.organizationId,
        domain: data.domain,
        default_page_slug: data.defaultPageSlug ?? null,
        mode,
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
    // Load org for entitlement + primary reset
    const { data: target } = await context.supabase
      .from("website_custom_domains")
      .select("organization_id")
      .eq("id", data.id)
      .single();
    if (data.mode === "portal" && target) {
      const { data: entitled, error: entErr } = await context.supabase
        .rpc("has_white_label", { _org: target.organization_id });
      if (entErr) throw new Error(entErr.message);
      if (!entitled) {
        throw new Error(
          "Portal-mode domains require the white-label add-on. Upgrade your plan to switch this domain to Portal mode.",
        );
      }
    }
    if (data.isPrimary && target) {
      await context.supabase
        .from("website_custom_domains")
        .update({ is_primary: false })
        .eq("organization_id", target.organization_id);
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
  const host = getEffectiveHost();
  if (!host) return { redirectTo: null as string | null };
  if (RESERVED_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))) {
    return { redirectTo: null };
  }
  const hostParse = domainSchema.safeParse(host);
  if (!hostParse.success) return { redirectTo: null };
  const safeHost = hostParse.data;
  const bare = safeHost.replace(/^www\./, "");
  const { data: row } = await supabaseAdmin
    .from("website_custom_domains")
    .select("organization_id, default_page_slug, mode")
    .or(`domain.eq.${safeHost},domain.eq.${bare},domain.eq.www.${bare}`)
    .not("verified_at", "is", null)
    .maybeSingle();
  if (!row) return { redirectTo: null };
  if (row.mode === "portal") {
    // Portal mode: land on the app; /app gate bounces to /login if unauthenticated.
    return { redirectTo: "/app/dashboard" };
  }
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("slug")
    .eq("id", row.organization_id)
    .single();
  if (!org) return { redirectTo: null };
  return { redirectTo: `/p/${org.slug}/${row.default_page_slug || "home"}` };
});

// Resolves the current Host header to portal-mode branding context for the
// tenant, or null if the host isn't a verified portal-mode custom domain.
// Reads only branding fields via the admin client — no other org data.
export const getPortalContext = createServerFn({ method: "GET" }).handler(async () => {
  let host = "";
  try {
    host = (getRequestHost() || "").toLowerCase();
  } catch {
    return { portal: null as null | {
      organizationId: string;
      orgSlug: string;
      name: string;
      portal_name: string | null;
      logo_url: string | null;
      favicon_url: string | null;
      accent_color: string | null;
      welcome_message: string | null;
      join_policy: "invite_only" | "approval";
      plan: "starter" | "pro" | "firm";
      entitled: boolean;
      show_powered_by: boolean;
    } };
  }
  if (!host) return { portal: null };
  host = host.replace(/:\d+$/, "");
  if (RESERVED_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))) {
    return { portal: null };
  }
  const hostParse = domainSchema.safeParse(host);
  if (!hostParse.success) return { portal: null };
  const safeHost = hostParse.data;
  const bare = safeHost.replace(/^www\./, "");
  const { data: row } = await supabaseAdmin
    .from("website_custom_domains")
    .select("organization_id, mode")
    .or(`domain.eq.${safeHost},domain.eq.${bare},domain.eq.www.${bare}`)
    .not("verified_at", "is", null)
    .maybeSingle();
  if (!row || row.mode !== "portal") return { portal: null };
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id, slug, name, portal_name, logo_url, favicon_url, accent_color, welcome_message, join_policy")
    .eq("id", row.organization_id)
    .single();
  if (!org) return { portal: null };
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("plan, status, trial_end")
    .eq("organization_id", row.organization_id)
    .maybeSingle();
  const s = sub as { plan?: string; status?: string; trial_end?: string | null } | null;
  const rawPlan = s?.plan;
  const plan = (rawPlan === "pro" ? "pro" : rawPlan === "firm" ? "firm" : "starter") as
    | "starter"
    | "pro"
    | "firm";
  const status = s?.status ?? null;
  const trialActive =
    status === "trialing" && (!s?.trial_end || new Date(s.trial_end) > new Date());
  const statusOk = status === "active" || status === "grandfathered" || trialActive;
  // Server-authoritative: entitlement = top-tier plan AND current subscription.
  const entitled = plan === "firm" && statusOk;
  // If entitlement lapses (downgrade or non-current sub), show the LexGuild mark.
  const show_powered_by = !entitled;
  const jp = org.join_policy;
  return {
    portal: {
      organizationId: org.id,
      orgSlug: org.slug,
      name: org.name,
      portal_name: org.portal_name ?? null,
      logo_url: org.logo_url ?? null,
      favicon_url: org.favicon_url ?? null,
      accent_color: org.accent_color ?? null,
      welcome_message: org.welcome_message ?? null,
      join_policy: (jp === "approval" ? "approval" : "invite_only") as "invite_only" | "approval",
      plan,
      entitled,
      show_powered_by,
    },
  };
});




