import { createFileRoute } from "@tanstack/react-router";
import { getEffectiveHost } from "@/lib/website-host.server";

export const Route = createFileRoute("/api/public/host-echo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const host = request.headers.get("host") ?? "";
        const xForwardedHost = request.headers.get("x-forwarded-host") ?? "";
        let effectiveHost = "";
        let adminEnv = { urlSet: false, serviceKeySet: false };
        let lookup: { found: boolean; mode: string | null; verified: boolean } = {
          found: false,
          mode: null,
          verified: false,
        };
        let queryError: string | null = null;
        let error: string | null = null;

        try {
          effectiveHost = getEffectiveHost();
          adminEnv = {
            urlSet: !!process.env.SUPABASE_URL,
            serviceKeySet: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          };

          if (effectiveHost && adminEnv.urlSet && adminEnv.serviceKeySet) {
            try {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              const bare = effectiveHost.replace(/^www\./, "");
              const { data, error: qErr } = await supabaseAdmin
                .from("website_custom_domains")
                .select("mode, verified_at")
                .or(`domain.eq.${effectiveHost},domain.eq.${bare},domain.eq.www.${bare}`)
                .maybeSingle();
              if (qErr) {
                queryError = qErr.message;
              } else if (data) {
                lookup = {
                  found: true,
                  mode: (data as { mode: string | null }).mode ?? null,
                  verified: !!(data as { verified_at: string | null }).verified_at,
                };
              }
            } catch (e) {
              queryError = e instanceof Error ? e.message : String(e);
            }
          }
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }

        return Response.json({
          host,
          xForwardedHost,
          effectiveHost,
          adminEnv,
          lookup,
          queryError,
          error,
        });
      },
    },
  },
});
