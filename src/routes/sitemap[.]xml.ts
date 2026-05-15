import { createFileRoute } from "@tanstack/react-router";
import { getRequestHost } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PRIMARY_HOST = "lexguild.com";
const RESERVED_HOST_SUFFIXES = ["lexguild.com", "lovable.app", "lovable.dev", "localhost"];

interface Entry {
  loc: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly";
  priority?: string;
}

const STATIC_PATHS = ["/", "/privacy", "/terms"];

function xmlEscape(s: string) {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;",
  );
}

function render(entries: Entry[]) {
  const urls = entries
    .map((e) =>
      [
        "  <url>",
        `    <loc>${xmlEscape(e.loc)}</loc>`,
        e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
        e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
        e.priority ? `    <priority>${e.priority}</priority>` : null,
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

async function loadOrgPages(organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from("website_pages")
    .select("slug,updated_at,published_at")
    .eq("organization_id", organizationId)
    .eq("status", "published");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const host = (getRequestHost() ?? PRIMARY_HOST).toLowerCase().split(":")[0];
        const isReserved = RESERVED_HOST_SUFFIXES.some(
          (suf) => host === suf || host.endsWith(`.${suf}`),
        );

        // Custom-domain request → only that org's pages, rooted at /
        if (!isReserved) {
          const { data: domain } = await supabaseAdmin
            .from("website_custom_domains")
            .select("organization_id,verified_at,default_page_slug")
            .eq("domain", host)
            .not("verified_at", "is", null)
            .maybeSingle();

          const entries: Entry[] = [];
          if (domain) {
            const pages = await loadOrgPages(domain.organization_id);
            for (const p of pages) {
              const isDefault = domain.default_page_slug === p.slug;
              entries.push({
                loc: `https://${host}${isDefault ? "/" : `/${p.slug}`}`,
                lastmod: (p.published_at ?? p.updated_at)?.slice(0, 10),
                changefreq: "weekly",
                priority: isDefault ? "1.0" : "0.7",
              });
            }
          }
          return new Response(render(entries), {
            headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
          });
        }

        // Primary host: marketing pages + every published tenant page under /p/$org/$slug
        const base = `https://${PRIMARY_HOST}`;
        const entries: Entry[] = STATIC_PATHS.map((p) => ({
          loc: `${base}${p}`,
          changefreq: "weekly",
          priority: p === "/" ? "1.0" : "0.5",
        }));

        const { data: pages, error } = await supabaseAdmin
          .from("website_pages")
          .select("slug,updated_at,published_at,organizations!inner(slug,paused)")
          .eq("status", "published");
        if (!error && pages) {
          for (const row of pages as Array<{
            slug: string;
            updated_at: string | null;
            published_at: string | null;
            organizations: { slug: string; paused: boolean } | null;
          }>) {
            const org = row.organizations;
            if (!org || org.paused) continue;
            entries.push({
              loc: `${base}/p/${org.slug}/${row.slug}`,
              lastmod: (row.published_at ?? row.updated_at)?.slice(0, 10),
              changefreq: "weekly",
              priority: "0.6",
            });
          }
        }

        return new Response(render(entries), {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
