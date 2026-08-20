// Server-only helpers for AI website generation: per-section schemas,
// validation, org context, guardrails, quotas, gateway calls.
import { z } from "zod";
import { orgKindLabel } from "@/lib/org-kind";

export const GUARDRAILS =
  "Never invent statistics, member counts, years, awards, prices, or quotes. If example content is unavoidable (testimonials, stats), clearly label it: '[Sample — replace with your organization's real content]'. Never produce legal advice or content that could be read as legal advice. Do not invent names of real people; use placeholder names only in clearly-labeled samples.";

export const PAGE_TYPES = [
  "home","landing","event","sponsor","committee","mentorship","cle","resource",
  "blog","legal_aid","custom",
] as const;

const str = { type: "string" } as const;

type FieldSpec = {
  /** JSON-schema properties for content_json of this section type. */
  properties: Record<string, unknown>;
  /** Zod schema producing the sanitized content_json. */
  zod: z.ZodTypeAny;
};

const hrefField = z.preprocess((v) => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.startsWith("/") || t.startsWith("#") || t.startsWith("https://") ? t : undefined;
}, z.string().optional());

const text = z.string().trim().min(1).optional();

function itemsSchema(props: Record<string, unknown>, required: string[]) {
  return {
    type: "array",
    minItems: 2,
    maxItems: 12,
    items: { type: "object", properties: props, required },
  };
}

export const SECTION_SPECS: Record<string, FieldSpec> = {
  hero: {
    properties: { headline: str, subheadline: str, cta_label: str, cta_href: str },
    zod: z.object({ headline: text, subheadline: text, cta_label: text, cta_href: hrefField }),
  },
  text: {
    properties: { headline: str, body: str },
    zod: z.object({ headline: text, body: text }),
  },
  image_text: {
    properties: { headline: str, body: str },
    zod: z.object({ headline: text, body: text }),
  },
  cta: {
    properties: { headline: str, cta_label: str, cta_href: str },
    zod: z.object({ headline: text, cta_label: text, cta_href: hrefField }),
  },
  event_details: {
    properties: { headline: str, event_date: str, location: str, body: str, credits: str },
    zod: z.object({
      headline: text, event_date: text, location: text, body: text, credits: text,
    }),
  },
  speaker_cards: {
    properties: { headline: str, items: itemsSchema({ name: str, role: str, bio: str }, ["name"]) },
    zod: z.object({
      headline: text,
      items: z.array(z.object({ name: z.string().trim().min(1), role: text, bio: text })).min(1),
    }),
  },
  committee_cards: {
    properties: { headline: str, items: itemsSchema({ name: str, role: str, bio: str }, ["name"]) },
    zod: z.object({
      headline: text,
      items: z.array(z.object({ name: z.string().trim().min(1), role: text, bio: text })).min(1),
    }),
  },
  sponsor_grid: {
    properties: { headline: str, items: itemsSchema({ name: str, tier: str }, ["name"]) },
    zod: z.object({
      headline: text,
      items: z.array(z.object({ name: z.string().trim().min(1), tier: text })).min(1),
    }),
  },
  resource_cards: {
    properties: {
      headline: str,
      items: itemsSchema({ title: str, description: str, kind: str }, ["title"]),
    },
    zod: z.object({
      headline: text,
      items: z.array(z.object({ title: z.string().trim().min(1), description: text, kind: text })).min(1),
    }),
  },
  faq: {
    properties: {
      headline: str,
      items: itemsSchema({ question: str, answer: str }, ["question", "answer"]),
    },
    zod: z.object({
      headline: text,
      items: z.array(z.object({ question: z.string().trim().min(1), answer: z.string().trim().min(1) })).min(1),
    }),
  },
  testimonials: {
    properties: {
      headline: str,
      items: itemsSchema({ quote: str, author: str }, ["quote", "author"]),
    },
    zod: z.object({
      headline: text,
      items: z.array(z.object({ quote: z.string().trim().min(1), author: z.string().trim().min(1) })).min(1),
    }),
  },
  pricing_tiers: {
    properties: {
      headline: str,
      items: itemsSchema(
        { name: str, price: str, features: { type: "array", items: str } },
        ["name"],
      ),
    },
    zod: z.object({
      headline: text,
      items: z.array(z.object({
        name: z.string().trim().min(1),
        price: text,
        features: z.array(z.string().trim().min(1)).optional(),
      })).min(1),
    }),
  },
  feature_grid: {
    properties: { headline: str, items: itemsSchema({ title: str, body: str }, ["title"]) },
    zod: z.object({
      headline: text,
      items: z.array(z.object({ title: z.string().trim().min(1), body: text })).min(1),
    }),
  },
  stats: {
    properties: { headline: str, items: itemsSchema({ label: str, value: str }, ["label", "value"]) },
    zod: z.object({
      headline: text,
      items: z.array(z.object({ label: z.string().trim().min(1), value: z.string().trim().min(1) })).min(1),
    }),
  },
  timeline: {
    properties: {
      headline: str,
      items: itemsSchema({ title: str, body: str, date: str }, ["title"]),
    },
    zod: z.object({
      headline: text,
      items: z.array(z.object({ title: z.string().trim().min(1), body: text, date: text })).min(1),
    }),
  },
  newsletter: { properties: { headline: str }, zod: z.object({ headline: text }) },
  contact_form: { properties: { headline: str }, zod: z.object({ headline: text }) },
  member_directory: { properties: { headline: str }, zod: z.object({ headline: text }) },
};

/** Section types the model may generate (custom_html and video are excluded). */
export const AI_SECTION_TYPES = Object.keys(SECTION_SPECS);

export function isAiSectionType(t: unknown): t is string {
  return typeof t === "string" && Object.prototype.hasOwnProperty.call(SECTION_SPECS, t);
}

/** JSON-schema for the sections array offered to the model. */
export function sectionsParameterSchema() {
  return {
    type: "array",
    minItems: 3,
    maxItems: 10,
    items: {
      type: "object",
      properties: {
        section_type: { type: "string", enum: AI_SECTION_TYPES },
        content_json: {
          type: "object",
          description:
            "Use ONLY the fields defined for the chosen section_type: " +
            AI_SECTION_TYPES.map(
              (t) => `${t}: ${Object.keys(SECTION_SPECS[t].properties).join(", ")}`,
            ).join(" | "),
          properties: Object.values(SECTION_SPECS).reduce<Record<string, unknown>>(
            (acc, spec) => ({ ...acc, ...spec.properties }),
            {},
          ),
        },
      },
      required: ["section_type", "content_json"],
    },
  };
}

/**
 * Plain-string JSON schema for one section type: no enums, no anyOf, no
 * min/max constraints. Item arrays become arrays of plain string objects.
 */
function plainProperties(sectionType: string): Record<string, unknown> {
  const spec = SECTION_SPECS[sectionType];
  if (!spec) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(spec.properties)) {
    const v = value as { type?: string; items?: { properties?: Record<string, unknown> } };
    if (v?.type === "array") {
      const itemProps = v.items?.properties ?? {};
      const plainItem: Record<string, unknown> = {};
      for (const k of Object.keys(itemProps)) plainItem[k] = { type: "string" };
      out[key] = { type: "array", items: { type: "object", properties: plainItem } };
    } else {
      out[key] = { type: "string" };
    }
  }
  return out;
}

/**
 * Flat, request-specific schema for a known skeleton: one numbered key per
 * section (s1..sN), each holding only that section type's plain fields.
 */
export function skeletonParameterSchema(skeleton: string[]) {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  skeleton.forEach((type, i) => {
    const key = `s${i + 1}`;
    properties[key] = {
      type: "object",
      description: `Content for the ${type} section`,
      properties: plainProperties(type),
    };
    required.push(key);
  });
  return { type: "object", properties, required };
}

/** Human-readable content vocabulary listed in the system prompt. */
export function sectionVocabularyText(): string {
  return AI_SECTION_TYPES.map((t) => {
    const props = SECTION_SPECS[t].properties;
    const fields = Object.entries(props)
      .map(([k, v]) => {
        const spec = v as { type?: string; items?: { properties?: Record<string, unknown> } };
        if (spec?.type === "array") {
          return `${k} (array of objects with: ${Object.keys(spec.items?.properties ?? {}).join(", ")})`;
        }
        return k;
      })
      .join(", ");
    return `- ${t}: ${fields}`;
  }).join("\n");
}

/** JSON-schema properties for one section type (used by regenerateSection). */
export function sectionContentSchema(sectionType: string) {
  const spec = SECTION_SPECS[sectionType];
  if (!spec) return null;
  return { type: "object", properties: plainProperties(sectionType) };
}


function stripUndefined(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

/** Validate one AI section; returns null when it must be dropped. */
export function validateSection(
  raw: unknown,
): { section_type: string; content_json: Record<string, unknown> } | null {
  const s = raw as { section_type?: unknown; content_json?: unknown } | null;
  if (!s || !isAiSectionType(s.section_type)) return null;
  const spec = SECTION_SPECS[s.section_type];
  const parsed = spec.zod.safeParse(s.content_json ?? {});
  if (!parsed.success) return null;
  const content = stripUndefined(parsed.data as Record<string, unknown>);
  if (Object.keys(content).length === 0) return null;
  return { section_type: s.section_type, content_json: content };
}

/** Validate rewritten content for a single existing section. */
export function validateSectionContent(
  sectionType: string,
  raw: unknown,
): Record<string, unknown> | null {
  const spec = SECTION_SPECS[sectionType];
  if (!spec) return null;
  const parsed = spec.zod.safeParse(raw ?? {});
  if (!parsed.success) return null;
  const content = stripUndefined(parsed.data as Record<string, unknown>);
  return Object.keys(content).length === 0 ? null : content;
}

// ---------------- Org context ----------------

export async function loadOrgContext(supabase: any, organizationId: string): Promise<string> {
  const { data: org } = await supabase
    .from("organizations")
    .select("name, kind, portal_name, welcome_message, website")
    .eq("id", organizationId)
    .maybeSingle();
  const { data: brand } = await supabase
    .from("website_brand_settings")
    .select("seo_title_suffix, footer_text, contact_info, social_links")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!org) return "";
  const lines: string[] = [
    `Organization name: ${org.name}`,
    `Organization type: ${orgKindLabel(String(org.kind ?? "other"))}`,
  ];
  if (org.portal_name) lines.push(`Portal/brand name: ${org.portal_name}`);
  if (org.welcome_message) lines.push(`Welcome message: ${String(org.welcome_message).slice(0, 400)}`);
  if (org.website) lines.push(`Website: ${org.website}`);
  if (brand?.seo_title_suffix) lines.push(`SEO title suffix: ${brand.seo_title_suffix}`);
  if (brand?.footer_text) lines.push(`Footer text: ${String(brand.footer_text).slice(0, 300)}`);
  if (brand?.contact_info && Object.keys(brand.contact_info).length > 0) {
    lines.push(`Contact info: ${JSON.stringify(brand.contact_info).slice(0, 300)}`);
  }
  if (brand?.social_links && Object.keys(brand.social_links).length > 0) {
    lines.push(`Social links: ${JSON.stringify(brand.social_links).slice(0, 300)}`);
  }
  return `Organization context (use these real details; do not invent others):\n${lines.join("\n")}`;
}

// ---------------- Quotas ----------------

export const PLAN_AI_LIMITS: Record<"starter" | "pro" | "firm", number> = {
  starter: 20,
  pro: 100,
  firm: 300,
};

export async function checkAiQuota(
  supabase: any,
  organizationId: string,
): Promise<{ used: number; limit: number; remaining: number }> {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const rawPlan = (sub as { plan?: string } | null)?.plan;
  const plan = rawPlan === "pro" ? "pro" : rawPlan === "firm" ? "firm" : "starter";
  const limit = PLAN_AI_LIMITS[plan];

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { count } = await supabase
    .from("website_ai_generations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", start);
  const used = count ?? 0;
  if (used >= limit) {
    throw new Error("Monthly AI generation limit reached. Resets on the 1st.");
  }
  return { used, limit, remaining: Math.max(0, limit - used - 1) };
}

// ---------------- Gateway ----------------

export function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "").slice(0, 80) || "page";
}

export async function callGateway(opts: {
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

export async function logGeneration(
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
