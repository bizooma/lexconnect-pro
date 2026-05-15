import { createFileRoute } from "@tanstack/react-router";
import { getRequestHost } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PRIMARY_HOST = "lexguild.com";
const RESERVED_HOST_SUFFIXES = ["lexguild.com", "lovable.app", "lovable.dev", "localhost"];

const PRIMARY_BODY = `User-agent: *
Allow: /
Disallow: /app/
Disallow: /api/
Disallow: /login
Disallow: /signup
Disallow: /onboarding
Disallow: /accept-invite/
Disallow: /join/
Disallow: /unsubscribe

# AI / Answer engines (AEO) — explicitly allow
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Perplexity-User
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-Web
Allow: /
User-agent: anthropic-ai
Allow: /
User-agent: Applebot
Allow: /
User-agent: Applebot-Extended
Allow: /
User-agent: Bingbot
Allow: /
User-agent: CCBot
Allow: /
User-agent: meta-externalagent
Allow: /

Sitemap: https://${PRIMARY_HOST}/sitemap.xml
Host: https://${PRIMARY_HOST}
`;

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const host = (getRequestHost() ?? PRIMARY_HOST).toLowerCase().split(":")[0];
        const isReserved = RESERVED_HOST_SUFFIXES.some(
          (suf) => host === suf || host.endsWith(`.${suf}`),
        );

        if (isReserved) {
          return new Response(PRIMARY_BODY, {
            headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
          });
        }

        // Custom-domain robots: allow indexing only if domain is verified.
        const { data: domain } = await supabaseAdmin
          .from("website_custom_domains")
          .select("verified_at")
          .eq("domain", host)
          .maybeSingle();

        const body = domain?.verified_at
          ? `User-agent: *\nAllow: /\n\nSitemap: https://${host}/sitemap.xml\n`
          : `User-agent: *\nDisallow: /\n`;

        return new Response(body, {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
