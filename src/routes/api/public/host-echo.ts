import { createFileRoute } from "@tanstack/react-router";
import { getEffectiveHost } from "@/lib/website-host.server";

export const Route = createFileRoute("/api/public/host-echo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const host = request.headers.get("host") ?? "";
        const xForwardedHost = request.headers.get("x-forwarded-host") ?? "";
        let effectiveHost = "";
        try {
          effectiveHost = getEffectiveHost();
        } catch {
          effectiveHost = "";
        }
        return Response.json({ host, xForwardedHost, effectiveHost });
      },
    },
  },
});
