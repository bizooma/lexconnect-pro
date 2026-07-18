import { createServerFn } from "@tanstack/react-start";
import { getHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rateLimit } from "@/lib/rate-limit";

export const trackPageView = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        pageId: z.string().uuid(),
        referrer: z.string().max(500).optional().nullable(),
        userAgent: z.string().max(500).optional().nullable(),
        visitorHash: z.string().max(128).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // Per-IP rate limit — noisy analytics flood protection.
    let ip = "unknown";
    try {
      ip =
        getHeader("cf-connecting-ip") ||
        getHeader("x-real-ip") ||
        (getHeader("x-forwarded-for") || "").split(",")[0].trim() ||
        "unknown";
    } catch {
      // ignore — SSR context may not have headers
    }
    const rl = rateLimit(`pv:${ip}:${data.pageId}`, { limit: 30, windowMs: 60_000 });
    if (!rl.allowed) return { ok: false, throttled: true };

    // Verify the page is published and belongs to the claimed org before inserting.
    const { data: page, error: pageErr } = await supabaseAdmin
      .from("website_pages")
      .select("id, status, organization_id")
      .eq("id", data.pageId)
      .maybeSingle();
    if (pageErr) throw new Error(pageErr.message);
    if (!page || page.status !== "published" || page.organization_id !== data.organizationId) {
      return { ok: false, ignored: true };
    }

    const { error } = await supabaseAdmin.from("website_page_views").insert({
      organization_id: data.organizationId,
      page_id: data.pageId,
      referrer: data.referrer ?? null,
      user_agent: data.userAgent ?? null,
      visitor_hash: data.visitorHash ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getWebsiteAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        days: z.number().int().min(1).max(90).default(30),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - data.days * 86400_000);
    const { data: rows, error } = await supabase
      .from("website_page_views")
      .select("created_at, page_id")
      .eq("organization_id", data.organizationId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true })
      .limit(10000);
    if (error) throw new Error(error.message);

    // Daily series
    const byDay = new Map<string, number>();
    for (let i = data.days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000);
      byDay.set(d.toISOString().slice(0, 10), 0);
    }
    const byPage = new Map<string, number>();
    for (const r of rows ?? []) {
      const k = r.created_at.slice(0, 10);
      byDay.set(k, (byDay.get(k) ?? 0) + 1);
      byPage.set(r.page_id, (byPage.get(r.page_id) ?? 0) + 1);
    }

    const series = Array.from(byDay.entries()).map(([date, views]) => ({ date, views }));

    // Resolve top page titles
    const topIds = Array.from(byPage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    let titles: Record<string, string> = {};
    if (topIds.length) {
      const { data: pages } = await supabase
        .from("website_pages")
        .select("id,title")
        .in(
          "id",
          topIds.map(([id]) => id),
        );
      titles = Object.fromEntries((pages ?? []).map((p) => [p.id, p.title]));
    }
    const topPages = topIds.map(([id, views]) => ({
      pageId: id,
      title: titles[id] ?? "Untitled",
      views,
    }));

    return { series, total: rows?.length ?? 0, topPages };
  });
