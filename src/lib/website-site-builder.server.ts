// Server-only internals for the "Build my site" wizard: multi-page,
// sitemap-aware draft generation in a single run.
import {
  GUARDRAILS,
  PLAN_AI_LIMITS,
  SECTION_SPECS,
  callGateway,
  isAiSectionType,
  loadOrgContext,
  logFailedGeneration,
  logGeneration,
  normalizePageType,
  sectionVocabularyText,
  sectionsParameterSchema,
  skeletonParameterSchema,
  slugify,
  validateSection,
  validateSectionContent,
} from "@/lib/website-ai.server";

export const MODEL = "google/gemini-2.5-flash";

export type SitePageInput = {
  key: string;
  title: string;
  mode: "template" | "freeform" | "module_intro";
  templateName?: string;
  brief?: string;
  moduleTarget?: "sponsors" | "wellbeing";
};

export type SiteProfileInput = {
  founded_year?: number | null;
  region?: string | null;
  audience?: string | null;
  tone?: string | null;
  primary_goal?: string | null;
  programs?: string[];
  contact?: Record<string, string>;
  notes?: string | null;
};

export type SitePageResult = {
  key: string;
  pageId: string | null;
  slug: string | null;
  error: string | null;
};

type Section = { section_type: string; content_json: Record<string, unknown> };

/** Monthly usage snapshot (non-throwing counterpart of checkAiQuota). */
export async function getAiUsage(supabase: any, organizationId: string) {
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
  return { used, limit, remaining: Math.max(0, limit - used) };
}

export async function saveSiteProfile(
  supabase: any,
  organizationId: string,
  userId: string,
  profile: SiteProfileInput,
) {
  const { error } = await supabase.from("org_site_profile").upsert(
    {
      organization_id: organizationId,
      founded_year: profile.founded_year ?? null,
      region: profile.region ?? null,
      audience: profile.audience ?? null,
      tone: profile.tone ?? null,
      primary_goal: profile.primary_goal ?? null,
      programs: profile.programs ?? [],
      contact: profile.contact ?? {},
      notes: profile.notes ?? null,
      updated_by: userId,
    },
    { onConflict: "organization_id" },
  );
  // Only org admins may write the profile (RLS); surface that clearly.
  if (error) throw new Error(`Could not save the site profile: ${error.message}`);
}

/** Public base path for the org's site (custom site-mode domain when present). */
export async function siteBaseUrl(supabase: any, organizationId: string): Promise<string> {
  const { data: org } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", organizationId)
    .maybeSingle();
  const { data: domains } = await supabase
    .from("website_custom_domains")
    .select("domain, mode, is_primary, verified_at")
    .eq("organization_id", organizationId)
    .eq("mode", "site")
    .not("verified_at", "is", null)
    .order("is_primary", { ascending: false })
    .limit(1);
  const domain = (domains ?? [])[0] as { domain?: string } | undefined;
  if (domain?.domain) return `https://${domain.domain}`;
  return `/p/${org?.slug ?? ""}`;
}

export function moduleHref(base: string, target: "sponsors" | "wellbeing") {
  return target === "sponsors" ? `${base}/sponsors` : `${base}/well-being`;
}

/** Deterministic planned slugs so cross-links can reference real siblings. */
export function planSlugs(pages: SitePageInput[]): string[] {
  const used = new Set<string>();
  return pages.map((p) => {
    let s = slugify(p.title);
    let i = 2;
    while (used.has(s)) s = `${slugify(p.title)}-${i++}`;
    used.add(s);
    return s;
  });
}

export function sitemapContext(
  pages: SitePageInput[],
  slugs: string[],
  base: string,
  currentIndex: number,
): string {
  const lines = pages.map(
    (p, i) =>
      `- ${p.title} → ${base}/${slugs[i]}${i === currentIndex ? "  (THIS PAGE)" : ""}`,
  );
  return [
    "Planned sitemap for this site. When linking between pages or writing CTAs, use ONLY these paths:",
    lines.join("\n"),
    "Never invent other internal links.",
  ].join("\n");
}

function insertPage(
  supabase: any,
  organizationId: string,
  userId: string,
  page: {
    title: string;
    slug: string;
    page_type: string;
    meta_title: string;
    meta_description: string;
    nav_order: number;
  },
) {
  return supabase
    .from("website_pages")
    .insert({
      organization_id: organizationId,
      title: page.title,
      slug: page.slug,
      page_type: page.page_type,
      status: "draft",
      show_in_nav: true,
      nav_order: page.nav_order,
      meta_title: page.meta_title,
      meta_description: page.meta_description,
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single();
}

async function persist(
  supabase: any,
  organizationId: string,
  userId: string,
  meta: {
    title: string;
    slug: string;
    page_type: string;
    meta_title: string;
    meta_description: string;
    nav_order: number;
  },
  sections: Section[],
): Promise<string> {
  const { data: pageRow, error } = await insertPage(supabase, organizationId, userId, meta);
  if (error) throw new Error(error.message);
  const rows = sections.map((s, i) => ({
    page_id: pageRow.id,
    organization_id: organizationId,
    section_type: s.section_type,
    display_order: i,
    settings_json: {},
    content_json: s.content_json,
    visible: true,
    responsive_json: {},
  }));
  if (rows.length > 0) {
    const { error: secErr } = await supabase.from("website_sections").insert(rows);
    if (secErr) throw new Error(secErr.message);
  }
  return pageRow.id as string;
}

// ---------------- Per-mode generation ----------------

async function generateFreeform(opts: {
  supabase: any;
  organizationId: string;
  userId: string;
  orgContext: string;
  sitemap: string;
  page: SitePageInput;
  slug: string;
  navOrder: number;
}) {
  const { supabase, organizationId, userId, page } = opts;
  const system = [
    "You generate website page drafts for legal organizations (bar associations, legal aid, law firms). Be professional, concise, accessible. Use clear headings and short paragraphs.",
    `Allowed section_type values and the EXACT content_json fields each one accepts:\n${sectionVocabularyText()}`,
    "Each section's content_json must use ONLY the fields listed for that section_type. Do not add other fields. Do not output image URLs.",
    opts.orgContext,
    opts.sitemap,
    GUARDRAILS,
  ]
    .filter(Boolean)
    .join("\n\n");

  const prompt = `Page title: ${page.title}\n${page.brief ? `Brief: ${page.brief}` : "Write a page that fits this title and the organization context."}`;

  const output = await callGateway({
    model: MODEL,
    system,
    user: prompt,
    toolName: "generate_page_draft",
    toolDescription: "Return a structured website page draft.",
    parameters: {
      type: "object",
      properties: {
        page_type: { type: "string" },
        meta_title: { type: "string" },
        meta_description: { type: "string" },
        sections: sectionsParameterSchema(),
      },
      required: ["page_type", "meta_title", "meta_description", "sections"],
    },
  });

  const raw = Array.isArray(output.sections) ? output.sections : [];
  const sections = raw
    .map((s: unknown) => validateSection(s))
    .filter((s): s is Section => s !== null);
  if (sections.length === 0) {
    await logFailedGeneration(supabase, organizationId, userId, "page_draft", prompt, output);
    throw new Error("The AI returned no usable sections for this page.");
  }

  const pageId = await persist(
    supabase,
    organizationId,
    userId,
    {
      title: page.title,
      slug: opts.slug,
      page_type: normalizePageType(output.page_type),
      meta_title: String(output.meta_title || page.title).slice(0, 120),
      meta_description: String(output.meta_description || "").slice(0, 320),
      nav_order: opts.navOrder,
    },
    sections,
  );
  await logGeneration(supabase, organizationId, userId, "page_draft", prompt, output, MODEL);
  return pageId;
}

async function generateTemplate(opts: {
  supabase: any;
  organizationId: string;
  userId: string;
  orgContext: string;
  sitemap: string;
  page: SitePageInput;
  slug: string;
  navOrder: number;
}) {
  const { supabase, organizationId, userId, page } = opts;
  const { data: tpl } = await supabase
    .from("website_templates")
    .select("id,name,page_type,default_sections_json,starter_prompt,is_global,organization_id")
    .ilike("name", page.templateName ?? "")
    .or(`is_global.eq.true,organization_id.eq.${organizationId}`)
    .limit(1)
    .maybeSingle();
  if (!tpl) throw new Error(`Template "${page.templateName}" was not found.`);

  const skeleton = (Array.isArray(tpl.default_sections_json) ? tpl.default_sections_json : [])
    .map((s: unknown) => (s as { section_type?: unknown }).section_type)
    .filter((t: unknown): t is string => typeof t === "string" && isAiSectionType(t));
  if (skeleton.length === 0) throw new Error("This template has no AI-generatable sections.");

  const structureSpec = skeleton
    .map((t, i) => `s${i + 1} = ${t} — fields: ${Object.keys(SECTION_SPECS[t].properties).join(", ")}`)
    .join("\n");

  const prompt = `Page title: ${page.title}\n${page.brief ? `Brief: ${page.brief}` : ""}`.trim();

  const output = await callGateway({
    model: MODEL,
    system: [
      "You generate website page drafts for legal organizations (bar associations, legal aid, law firms). Be professional, concise, accessible.",
      `Template: ${tpl.name}. ${tpl.starter_prompt ?? ""}`.trim(),
      `Fill one object per numbered key, in this order:\n${structureSpec}`,
      "Use ONLY the fields listed for each key. Do not output image URLs.",
      opts.orgContext,
      opts.sitemap,
      GUARDRAILS,
    ]
      .filter(Boolean)
      .join("\n\n"),
    user: prompt,
    toolName: "generate_page_from_template",
    toolDescription: "Return a structured website page draft matching the template structure.",
    parameters: {
      type: "object",
      properties: {
        meta_title: { type: "string" },
        meta_description: { type: "string" },
        ...(skeletonParameterSchema(skeleton).properties as Record<string, unknown>),
      },
      required: ["meta_title", "meta_description", ...skeleton.map((_, i) => `s${i + 1}`)],
    },
  });

  const sections: Section[] = [];
  skeleton.forEach((type, i) => {
    const clean = validateSectionContent(type, output[`s${i + 1}`] ?? {});
    if (clean) sections.push({ section_type: type, content_json: clean });
  });
  if (sections.length === 0) {
    await logFailedGeneration(supabase, organizationId, userId, "template_draft", prompt, output);
    throw new Error("The AI returned no usable sections for this template page.");
  }

  const pageId = await persist(
    supabase,
    organizationId,
    userId,
    {
      title: page.title,
      slug: opts.slug,
      page_type: tpl.page_type,
      meta_title: String(output.meta_title || page.title).slice(0, 120),
      meta_description: String(output.meta_description || "").slice(0, 320),
      nav_order: opts.navOrder,
    },
    sections,
  );
  await logGeneration(
    supabase,
    organizationId,
    userId,
    "page_draft",
    `[Template: ${tpl.name}] ${prompt}`.slice(0, 2000),
    output,
    MODEL,
  );
  return pageId;
}

async function generateModuleIntro(opts: {
  supabase: any;
  organizationId: string;
  userId: string;
  orgContext: string;
  sitemap: string;
  page: SitePageInput;
  slug: string;
  navOrder: number;
  href: string;
}) {
  const { supabase, organizationId, userId, page } = opts;
  const skeleton = ["hero", "text", "cta"];
  const label = page.moduleTarget === "sponsors" ? "sponsorship program" : "well-being program";
  const prompt = `Short intro page titled "${page.title}" that introduces the organization's ${label} and sends visitors to the live ${label} page. ${page.brief ?? ""}`.trim();

  const output = await callGateway({
    model: MODEL,
    system: [
      "You write short, professional intro pages for legal organizations. Keep it to a hero, one short body section, and a call to action.",
      `Fill one object per numbered key: ${skeleton.map((t, i) => `s${i + 1} = ${t}`).join(", ")}.`,
      "Do not duplicate the live module's content — summarize and point to it. Do not output image URLs or link paths; the CTA link is set automatically.",
      opts.orgContext,
      opts.sitemap,
      GUARDRAILS,
    ]
      .filter(Boolean)
      .join("\n\n"),
    user: prompt,
    toolName: "generate_module_intro",
    toolDescription: "Return a short intro page (hero, text, cta).",
    parameters: {
      type: "object",
      properties: {
        meta_title: { type: "string" },
        meta_description: { type: "string" },
        ...(skeletonParameterSchema(skeleton).properties as Record<string, unknown>),
      },
      required: ["meta_title", "meta_description", ...skeleton.map((_, i) => `s${i + 1}`)],
    },
  });

  const sections: Section[] = [];
  skeleton.forEach((type, i) => {
    const clean = validateSectionContent(type, output[`s${i + 1}`] ?? {});
    if (!clean) return;
    if (type === "hero" || type === "cta") {
      clean["cta_href"] = opts.href;
      if (!clean["cta_label"]) {
        clean["cta_label"] = page.moduleTarget === "sponsors" ? "View sponsors" : "Explore well-being";
      }
    }
    sections.push({ section_type: type, content_json: clean });
  });
  if (sections.length === 0) {
    await logFailedGeneration(supabase, organizationId, userId, "page_draft", prompt, output);
    throw new Error("The AI returned no usable sections for this module page.");
  }

  const pageId = await persist(
    supabase,
    organizationId,
    userId,
    {
      title: page.title,
      slug: opts.slug,
      page_type: page.moduleTarget === "sponsors" ? "sponsor" : "custom",
      meta_title: String(output.meta_title || page.title).slice(0, 120),
      meta_description: String(output.meta_description || "").slice(0, 320),
      nav_order: opts.navOrder,
    },
    sections,
  );
  await logGeneration(supabase, organizationId, userId, "page_draft", prompt, output, MODEL);
  return pageId;
}

// ---------------- Orchestrator ----------------

export async function buildSite(opts: {
  supabase: any;
  userId: string;
  organizationId: string;
  profile: SiteProfileInput;
  pages: SitePageInput[];
}): Promise<{ results: SitePageResult[]; used: number; limit: number; remaining: number }> {
  const { supabase, userId, organizationId, pages } = opts;

  await saveSiteProfile(supabase, organizationId, userId, opts.profile);

  const quota = await getAiUsage(supabase, organizationId);
  if (quota.remaining < pages.length) {
    throw new Error(
      `This site needs ${pages.length} AI generations but only ${quota.remaining} remain this month (${quota.used} of ${quota.limit} used). Remove pages or wait for the reset on the 1st.`,
    );
  }

  const orgContext = await loadOrgContext(supabase, organizationId);
  const base = await siteBaseUrl(supabase, organizationId);
  const slugs = planSlugs(pages);

  const results: SitePageResult[] = [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const shared = {
      supabase,
      organizationId,
      userId,
      orgContext,
      sitemap: sitemapContext(pages, slugs, base, i),
      page,
      slug: slugs[i],
      navOrder: (i + 1) * 10,
    };
    try {
      let pageId: string;
      if (page.mode === "template") pageId = await generateTemplate(shared);
      else if (page.mode === "module_intro") {
        pageId = await generateModuleIntro({
          ...shared,
          href: moduleHref(base, page.moduleTarget ?? "sponsors"),
        });
      } else pageId = await generateFreeform(shared);
      results.push({ key: page.key, pageId, slug: slugs[i], error: null });
    } catch (e) {
      results.push({
        key: page.key,
        pageId: null,
        slug: null,
        error: e instanceof Error ? e.message : "Generation failed",
      });
    }
  }

  const after = await getAiUsage(supabase, organizationId);
  return { results, used: after.used, limit: after.limit, remaining: after.remaining };
}
