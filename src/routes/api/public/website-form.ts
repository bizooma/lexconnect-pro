import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const submitSchema = z.object({
  organizationId: z.string().uuid(),
  pageId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid().optional().nullable(),
  formKind: z.enum(["newsletter", "contact"]),
  data: z.record(z.string().min(1).max(80), z.string().max(4000)).default({}),
});

export const Route = createFileRoute("/api/public/website-form")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
