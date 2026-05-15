import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SECTION_TYPES = [
  "hero","text","image_text","cta","event_details","sponsor_grid","speaker_cards",
  "member_directory","committee_cards","resource_cards","faq","testimonials",
  "contact_form","newsletter","video","pricing_tiers","feature_grid","stats",
  "timeline","custom_html",
] as const;

const PAGE_TYPES = [
  "home","landing","event","sponsor","committee","mentorship","cle","resource",
  "blog","legal_aid","custom",
] as const;

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "").slice(0, 80) || "page";
}

async function callGateway(opts: {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  parameters: Record<string, unknown>;
  model?: string;
}): Promise<Record<string, unknown>> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI gateway is not configured.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      tools: [{
        type: "function",
        function: {
          name: opts.toolName,
          description: opts.toolDescription,
          parameters: opts.parameters,
        },
      }],
      tool_choice: { type: "function", function: { name: opts.toolName } },
    }),
  });
  if (res.status === 429) throw new Error("AI is rate limited. Please try again in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway error (${res.status}): ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  const call = json?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) throw new Error("AI returned no structured output.");
  try {
    return JSON.parse(call.function.arguments);
  } catch {
    throw new Error("AI returned malformed structured output.");
  }
}

async function logGeneration(
  supabase: any,
  organizationId: string,
  userId: string,
  kind: string,
  prompt: string,
  output: Record<string, unknown>,
  model: string,
) {
  await (supabase.from("website_ai_generations") as any).insert({
    organization_id: organizationId,
    user_id: userId,
    kind,
    prompt,
    generated_content_json: output,
    model,
  });
}

// ---------------- Generate full page draft ----------------

export const generatePageDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      organizationId: z.string().uuid(),
      prompt: z.string().min(10).max(2000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const model = "google/gemini-2.5-flash";

    const output = await callGateway({
      model,
      system: "You generate website page drafts for legal organizations (bar associations, legal aid, law firms). Be professional, concise, accessible. Use clear headings and short paragraphs.",
      user: data.prompt,
      toolName: "generate_page_draft",
      toolDescription: "Return a structured website page draft.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          slug: { type: "string" },
          page_type: { type: "string", enum: PAGE_TYPES as unknown as string[] },
          meta_title: { type: "string" },
          meta_description: { type: "string" },
          sections: {
            type: "array",
            minItems: 3,
            maxItems: 10,
            items: {
              type: "object",
              properties: {
                section_type: { type: "string", enum: SECTION_TYPES as unknown as string[] },
                content_json: {
                  type: "object",
                  properties: {
                    headline: { type: "string" },
                    subheadline: { type: "string" },
                    body: { type: "string" },
                    cta_label: { type: "string" },
                    cta_href: { type: "string" },
                    image_url: { type: "string" },
                    items: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          description: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
              required: ["section_type", "content_json"],
            },
          },
        },
        required: ["title", "slug", "page_type", "meta_title", "meta_description", "sections"],
      },
    });

    // Persist as a draft page + sections
    const title = String(output.title || "Untitled page").slice(0, 200);
    const slug = slugify(String(output.slug || title));
    const pageType = String(output.page_type || "custom");
    const metaTitle = String(output.meta_title || title).slice(0, 120);
    const metaDescription = String(output.meta_description || "").slice(0, 320);
    const sections = Array.isArray(output.sections) ? output.sections : [];

    const { data: pageRow, error: pageErr } = await (supabase.from("website_pages") as any)
      .insert({
        organization_id: data.organizationId,
        title,
        slug,
        page_type: pageType,
        status: "draft",
        meta_title: metaTitle,
        meta_description: metaDescription,
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();
    if (pageErr) throw new Error(pageErr.message);

    const rows = sections.map((s: any, i: number) => ({
      page_id: pageRow.id,
      organization_id: data.organizationId,
      section_type: s.section_type,
      display_order: i,
      settings_json: {},
      content_json: s.content_json ?? {},
      visible: true,
      responsive_json: {},
    }));
    if (rows.length > 0) {
      const { error: secErr } = await (supabase.from("website_sections") as any).insert(rows);
      if (secErr) throw new Error(secErr.message);
    }

    await logGeneration(supabase, data.organizationId, userId, "page_draft", data.prompt, output, model);

    return { pageId: pageRow.id as string, slug };
  });

// ---------------- Regenerate / rewrite a single section ----------------

export const regenerateSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      sectionId: z.string().uuid(),
      instruction: z.string().min(3).max(1000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const model = "google/gemini-2.5-flash";

    const { data: section, error } = await supabase
      .from("website_sections")
      .select("id,organization_id,section_type,content_json")
      .eq("id", data.sectionId)
      .single();
    if (error || !section) throw new Error(error?.message || "Section not found");

    const output = await callGateway({
      model,
      system: "You rewrite a single website section's content. Return only the new content_json fields (headline, subheadline, body, cta_label, etc.). Be concise, professional, and on-brand for a legal organization.",
      user: `Section type: ${section.section_type}\nCurrent content: ${JSON.stringify(section.content_json)}\n\nInstruction: ${data.instruction}`,
      toolName: "rewrite_section",
      toolDescription: "Return updated content_json for the section.",
      parameters: {
        type: "object",
        properties: {
          headline: { type: "string" },
          subheadline: { type: "string" },
          body: { type: "string" },
          cta_label: { type: "string" },
          cta_href: { type: "string" },
          image_url: { type: "string" },
        },
      },
    });

    const merged = { ...(section.content_json as Record<string, unknown>), ...output };
    const { error: upErr } = await (supabase.from("website_sections") as any)
      .update({ content_json: merged })
      .eq("id", data.sectionId);
    if (upErr) throw new Error(upErr.message);

    await logGeneration(supabase, section.organization_id, userId, "section_rewrite", data.instruction, output, model);

    return { content_json: merged as Record<string, string> };
  });

// ---------------- Improve SEO meta ----------------

export const improvePageSeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ pageId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const model = "openai/gpt-5-mini";

    const { data: page, error } = await supabase
      .from("website_pages")
      .select("id,organization_id,title,slug,page_type,meta_title,meta_description")
      .eq("id", data.pageId)
      .single();
    if (error || !page) throw new Error(error?.message || "Page not found");

    const { data: sections } = await supabase
      .from("website_sections")
      .select("section_type,content_json")
      .eq("page_id", data.pageId)
      .order("display_order", { ascending: true });

    const output = await callGateway({
      model,
      system: "You optimize SEO metadata for legal organization websites. Title 50–60 chars, description 140–160 chars, both keyword-rich and human-readable.",
      user: `Page title: ${page.title}\nType: ${page.page_type}\nSections: ${JSON.stringify(sections ?? []).slice(0, 4000)}`,
      toolName: "improve_seo",
      toolDescription: "Return optimized meta_title and meta_description.",
      parameters: {
        type: "object",
        properties: {
          meta_title: { type: "string" },
          meta_description: { type: "string" },
        },
        required: ["meta_title", "meta_description"],
      },
    });

    const { error: upErr } = await (supabase.from("website_pages") as any)
      .update({
        meta_title: String(output.meta_title).slice(0, 120),
        meta_description: String(output.meta_description).slice(0, 320),
        updated_by: userId,
      })
      .eq("id", data.pageId);
    if (upErr) throw new Error(upErr.message);

    await logGeneration(supabase, page.organization_id, userId, "seo", page.title, output, model);

    return {
      meta_title: String(output.meta_title ?? ""),
      meta_description: String(output.meta_description ?? ""),
    };
  });
