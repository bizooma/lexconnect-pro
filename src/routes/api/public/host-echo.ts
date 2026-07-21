import { createFileRoute } from "@tanstack/react-router";
import { getEffectiveHost } from "@/lib/website-domains.functions";

export const Route = createFileRoute("/api/public/host-echo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const host = request.headers.get("host") ?? "";
        const xForwardedHost = request.headers.get("x-forwarded-host") ?? "";
        const effectiveHost = getEffectiveHost();
        return Response.json({ host, xForwardedHost, effectiveHost });
      },
    },
  },
});
