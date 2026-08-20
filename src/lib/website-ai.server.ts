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

/**
 * Shared flat content shape for freeform generation. Every field optional and
 * a plain string so the gateway's constrained decoder can actually emit values;
 * per-type zod validation strips whatever a section type doesn't use.
 */
function sharedContentSchema() {
  const s = { type: "string" } as const;
  return {
    type: "object",
    properties: {
      headline: s,
      subheadline: s,
      body: s,
      cta_label: s,
      cta_href: s,
      event_date: s,
      location: s,
      credits: s,
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: s,
            description: s,
            question: s,
            answer: s,
            name: s,
            role: s,
            bio: s,
            quote: s,
            author: s,
            price: s,
            label: s,
            value: s,
            date: s,
            kind: s,
            features: { type: "array", items: s },
          },
        },
      },
    },
  };
}

/** Simple JSON-schema for the sections array offered to the model. */
export function sectionsParameterSchema() {
  return {
    type: "array",
    minItems: 3,
    maxItems: 10,
    items: {
      type: "object",
      properties: {
        section_type: { type: "string" },
        content_json: sharedContentSchema(),
      },
      required: ["section_type", "content_json"],
    },
  };
}

/** Tool schema for a whole-page revision: refs onto existing section ids. */
export function revisionParameterSchema() {
  return {
    type: "object",
    properties: {
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            ref: { type: "string" },
            section_type: { type: "string" },
            content_json: sharedContentSchema(),
          },
          required: ["ref", "section_type", "content_json"],
        },
      },
    },
    required: ["sections"],
  };
}

const PAGE_TYPE_ALIASES: Record<string, string> = {
  landing_page: "landing",
  home_page: "home",
  homepage: "home",
  event_page: "event",
  events: "event",
  sponsors: "sponsor",
  sponsorship: "sponsor",
  committees: "committee",
  resources: "resource",
  blog_post: "blog",
  cle_page: "cle",
  legal_aid_page: "legal_aid",
};

/** Never pass a raw model string into the page_type enum column. */
export function normalizePageType(raw: unknown): string {
  const t = String(raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if ((PAGE_TYPES as readonly string[]).includes(t)) return t;
  const mapped = PAGE_TYPE_ALIASES[t];
  return mapped && (PAGE_TYPES as readonly string[]).includes(mapped) ? mapped : "custom";
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

// ---------------- Alias normalization ----------------

const FIELD_ALIASES: Record<string, string> = {
  title: "headline",
  subtitle: "subheadline",
  tagline: "subheadline",
  text: "body",
  description: "body",
  content: "body",
  q: "question",
  a: "answer",
  url: "cta_href",
  link: "cta_href",
  button: "cta_label",
  button_label: "cta_label",
  author_name: "author",
};

const SECTION_TYPE_ALIASES: Record<string, string> = {
  calendar: "event_details",
  events: "event_details",
  form: "contact_form",
  registration: "contact_form",
  about: "text",
};

/** Map near-miss section_type values onto known types. */
export function normalizeSectionType(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (isAiSectionType(t)) return t;
  const mapped = SECTION_TYPE_ALIASES[t];
  return mapped && isAiSectionType(mapped) ? mapped : null;
}

function renameKeys(
  obj: Record<string, unknown>,
  allowed: Set<string>,
  sectionType: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(obj)) {
    const key = rawKey.trim().toLowerCase().replace(/[\s-]+/g, "_");
    let target = key;
    if (!allowed.has(key)) {
      if (key === "name" && sectionType === "testimonials") target = "author";
      else target = FIELD_ALIASES[key] ?? key;
    }
    if (out[target] === undefined) out[target] = value;
  }
  return out;
}

/** Normalize model-emitted field aliases for one section's content_json. */
export function normalizeContent(sectionType: string, raw: unknown): Record<string, unknown> {
  const spec = SECTION_SPECS[sectionType];
  if (!spec || !raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const topAllowed = new Set(Object.keys(spec.properties));
  const content = renameKeys(raw as Record<string, unknown>, topAllowed, sectionType);

  const itemsSpec = spec.properties.items as
    | { items?: { properties?: Record<string, unknown> } }
    | undefined;
  if (itemsSpec && Array.isArray(content.items)) {
    const itemAllowed = new Set(Object.keys(itemsSpec.items?.properties ?? {}));
    content.items = (content.items as unknown[]).map((it) =>
      it && typeof it === "object" && !Array.isArray(it)
        ? renameKeys(it as Record<string, unknown>, itemAllowed, sectionType)
        : it,
    );
  }
  return content;
}

/** Validate one AI section; returns null when it must be dropped. */
export function validateSection(
  raw: unknown,
): { section_type: string; content_json: Record<string, unknown> } | null {
  const s = raw as { section_type?: unknown; content_json?: unknown } | null;
  if (!s) return null;
  const sectionType = normalizeSectionType(s.section_type);
  if (!sectionType) return null;
  const spec = SECTION_SPECS[sectionType];
  const parsed = spec.zod.safeParse(normalizeContent(sectionType, s.content_json ?? {}));
  if (!parsed.success) return null;
  const content = stripUndefined(parsed.data as Record<string, unknown>);
  if (Object.keys(content).length === 0) return null;
  return { section_type: sectionType, content_json: content };
}

/** Validate rewritten content for a single existing section. */
export function validateSectionContent(
  sectionType: string,
  raw: unknown,
): Record<string, unknown> | null {
  const spec = SECTION_SPECS[sectionType];
  if (!spec) return null;
  const parsed = spec.zod.safeParse(normalizeContent(sectionType, raw ?? {}));
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
  const profile = await loadSiteProfile(supabase, organizationId);
  if (profile) lines.push(profile);
  return `Organization context (use these real details; do not invent others):\n${lines.join("\n")}`;
}

/**
 * Durable, org-authored facts used on every AI generation.
 * Missing profile (or no read access) => empty string, behave exactly as before.
 */
export async function loadSiteProfile(supabase: any, organizationId: string): Promise<string> {
  const { data } = await supabase
    .from("org_site_profile")
    .select("founded_year, region, audience, tone, primary_goal, programs, contact, notes")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!data) return "";
  const p = data as {
    founded_year: number | null;
    region: string | null;
    audience: string | null;
    tone: string | null;
    primary_goal: string | null;
    programs: string[] | null;
    contact: Record<string, unknown> | null;
    notes: string | null;
  };
  const parts: string[] = [];
  if (p.founded_year) parts.push(`Founded ${p.founded_year}.`);
  if (p.region) parts.push(`Serves ${p.region}.`);
  if (p.programs && p.programs.length > 0) parts.push(`Programs: ${p.programs.slice(0, 12).join(", ")}.`);
  if (p.audience) parts.push(`Primary audience: ${p.audience}.`);
  if (p.tone) parts.push(`Tone: ${p.tone}.`);
  if (p.primary_goal) parts.push(`Primary goal: ${p.primary_goal}.`);
  if (p.contact && typeof p.contact === "object") {
    const c = p.contact as Record<string, unknown>;
    const bits = ["phone", "email", "address"]
      .map((k) => (typeof c[k] === "string" && c[k] ? `${k}: ${String(c[k]).slice(0, 160)}` : null))
      .filter(Boolean);
    if (bits.length) parts.push(`Contact: ${bits.join(", ")}.`);
  }
  if (p.notes) parts.push(String(p.notes).slice(0, 1000));
  if (parts.length === 0) return "";
  return `Site profile: ${parts.join(" ")}`;
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
    .gte("created_at", start)
    .not("kind", "like", "%\\_failed");

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

/**
 * Telemetry for generations that produced nothing usable. Logged with a
 * `_failed` kind so it never counts against the monthly quota.
 */
export async function logFailedGeneration(
  supabase: any,
  organizationId: string,
  userId: string,
  kind: string,
  prompt: string,
  raw: unknown,
) {
  try {
    await (supabase.from("website_ai_generations") as any).insert({
      organization_id: organizationId,
      user_id: userId,
      kind: `${kind}_failed`,
      prompt,
      generated_content_json: { failed: true, raw },
      model: "google/gemini-2.5-flash",
    });
  } catch {
    // telemetry must never break the request
  }
}
