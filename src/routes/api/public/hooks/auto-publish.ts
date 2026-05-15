import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/hooks/auto-publish")({
  server: {
    handlers: {
      POST: async () => {
        const nowIso = new Date().toISOString();
        const { data: due, error } = await supabaseAdmin
          .from("website_pages")
          .select("id")
          .eq("status", "scheduled")
          .lte("scheduled_at", nowIso);
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        let promoted = 0;
        for (const row of due ?? []) {
          const { error: upErr } = await supabaseAdmin
            .from("website_pages")
            .update({ status: "published", published_at: nowIso })
            .eq("id", row.id);
          if (!upErr) promoted += 1;
        }
        return new Response(JSON.stringify({ ok: true, promoted }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
