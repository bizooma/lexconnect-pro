import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { clientIpFromRequest, rateLimit } from "@/lib/rate-limit";

const submitSchema = z.object({
  organizationId: z.string().uuid(),
  pageId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid().optional().nullable(),
  formKind: z.enum(["newsletter", "contact"]),
  data: z.record(z.string().min(1).max(80), z.string().max(4000)).default({}),
});

// Hosts allowed to POST here. Tenant custom domains are validated below via DB lookup.
const ALLOWED_ORIGIN_SUFFIXES = [
  "lexguild.com",
  "lovable.app",
  "lovable.dev",
  "localhost",
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return ALLOWED_ORIGIN_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/website-form")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = clientIpFromRequest(request);
        const rl = rateLimit(`form:${ip}`, { limit: 10, windowMs: 60_000 });
        if (!rl.allowed) {
          return new Response(JSON.stringify({ error: "Too many requests" }), {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(rl.retryAfterSec),
            },
          });
        }

        // Origin check — accept known project hosts or any verified tenant custom domain.
        const origin = request.headers.get("origin");
        let originOk = isAllowedOrigin(origin);
        if (!originOk && origin) {
          try {
            const host = new URL(origin).hostname.toLowerCase().replace(/^www\./, "");
            const { data: dom } = await supabaseAdmin
              .from("website_custom_domains")
              .select("id")
              .or(`domain.eq.${host},domain.eq.www.${host}`)
              .not("verified_at", "is", null)
              .maybeSingle();
            originOk = Boolean(dom);
          } catch {
            originOk = false;
          }
        }
        if (!originOk) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const parsed = submitSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.message }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { organizationId, pageId, sectionId, formKind, data } = parsed.data;

        // Cheap honeypot: ignore if "company" field is filled (bots).
        if (typeof data.company === "string" && data.company.trim().length > 0) {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        // Second per-org rate limit to prevent a single org's public form being flooded.
        const orgRl = rateLimit(`form-org:${organizationId}:${ip}`, {
          limit: 5,
          windowMs: 60_000,
        });
        if (!orgRl.allowed) {
          return new Response(JSON.stringify({ error: "Too many requests" }), {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(orgRl.retryAfterSec),
            },
          });
        }

        const referrer = request.headers.get("referer")?.slice(0, 500) ?? null;
        const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

        const { error } = await supabaseAdmin.from("website_form_submissions").insert({
          organization_id: organizationId,
          page_id: pageId ?? null,
          section_id: sectionId ?? null,
          form_kind: formKind,
          data,
          referrer,
          user_agent: userAgent,
        });
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
