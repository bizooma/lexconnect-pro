import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgIdSchema = z.string().uuid();
const sectionTypeSchema = z.enum([
  "hero","text","image_text","cta","event_details","sponsor_grid","speaker_cards",
  "member_directory","committee_cards","resource_cards","faq","testimonials",
  "contact_form","newsletter","video","pricing_tiers","feature_grid","stats",
  "timeline","custom_html",
]);
const pageTypeSchema = z.enum([
  "home","landing","event","sponsor","committee","mentorship","cle","resource",
  "blog","legal_aid","custom",
]);
const pageStatusSchema = z.enum(["draft","ready_for_review","scheduled","published","archived"]);

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "").slice(0, 80) || "page";
}

// ---------------- PAGES ----------------

export const listWebsitePages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      organizationId: orgIdSchema,
      status: pageStatusSchema.optional(),
      pageType: pageTypeSchema.optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("website_pages")
      .select("id,title,slug,page_type,status,updated_at,published_at,scheduled_at,meta_title,meta_description")
      .eq("organization_id", data.organizationId)
      .order("updated_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    if (data.pageType) q = q.eq("page_type", data.pageType);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { pages: rows ?? [] };
  });

export const getWebsitePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ pageId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: page, error } = await supabase
      .from("website_pages")
      .select("*")
      .eq("id", data.pageId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!page) throw new Error("Page not found");
    const { data: sections, error: sErr } = await supabase
      .from("website_sections")
      .select("*")
      .eq("page_id", data.pageId)
      .order("display_order", { ascending: true });
    if (sErr) throw new Error(sErr.message);
    return { page, sections: sections ?? [] };
  });

export const createWebsitePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      organizationId: orgIdSchema,
      title: z.string().min(1).max(200),
      slug: z.string().min(1).max(100).optional(),
      pageType: pageTypeSchema.default("custom"),
      sections: z.array(z.object({
        section_type: sectionTypeSchema,
        settings_json: z.record(z.string(), z.unknown()).optional(),
        content_json: z.record(z.string(), z.unknown()).optional(),
      })).default([]),
      meta_title: z.string().max(200).optional(),
      meta_description: z.string().max(400).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const slug = slugify(data.slug || data.title);
    const { data: page, error } = await supabase
      .from("website_pages")
      .insert({
        organization_id: data.organizationId,
        title: data.title,
        slug,
        page_type: data.pageType,
        meta_title: data.meta_title ?? data.title,
        meta_description: data.meta_description ?? null,
        created_by: userId,
        updated_by: userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    if (data.sections.length > 0) {
      const rows = data.sections.map((s, i) => ({
        page_id: page.id,
        organization_id: data.organizationId,
        section_type: s.section_type,
        display_order: i,
        settings_json: s.settings_json ?? {},
        content_json: s.content_json ?? {},
      }));
      const { error: sErr } = await (supabase.from("website_sections") as any).insert(rows);
      if (sErr) throw new Error(sErr.message);
    }
    return { pageId: page.id };
  });

export const updateWebsitePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      pageId: z.string().uuid(),
      patch: z.object({
        title: z.string().min(1).max(200).optional(),
        slug: z.string().min(1).max(100).optional(),
        page_type: pageTypeSchema.optional(),
        meta_title: z.string().max(200).nullable().optional(),
        meta_description: z.string().max(400).nullable().optional(),
        og_title: z.string().max(200).nullable().optional(),
        og_description: z.string().max(400).nullable().optional(),
        og_image: z.string().url().nullable().optional(),
      }),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = { ...data.patch, updated_by: userId };
    if (data.patch.slug) patch.slug = slugify(data.patch.slug);
    const { error } = await supabase.from("website_pages").update(patch as any).eq("id", data.pageId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWebsitePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ pageId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("website_pages").delete().eq("id", data.pageId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateWebsitePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ pageId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: src, error } = await supabase.from("website_pages").select("*").eq("id", data.pageId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!src) throw new Error("Page not found");
    const newSlug = `${src.slug}-copy-${Math.random().toString(36).slice(2, 6)}`;
    const { data: copy, error: cErr } = await supabase.from("website_pages").insert({
      organization_id: src.organization_id,
      title: `${src.title} (Copy)`,
      slug: newSlug,
      page_type: src.page_type,
      status: "draft",
      meta_title: src.meta_title,
      meta_description: src.meta_description,
      og_title: src.og_title,
      og_description: src.og_description,
      og_image: src.og_image,
      content_json: src.content_json,
      created_by: userId,
      updated_by: userId,
    }).select("id").single();
    if (cErr) throw new Error(cErr.message);
    const { data: srcSections } = await supabase.from("website_sections").select("*").eq("page_id", data.pageId).order("display_order");
    if (srcSections && srcSections.length > 0) {
      const rows = srcSections.map((s) => ({
        page_id: copy.id,
        organization_id: s.organization_id,
        section_type: s.section_type,
        display_order: s.display_order,
        settings_json: s.settings_json,
        content_json: s.content_json,
        visible: s.visible,
        responsive_json: s.responsive_json,
      }));
      await supabase.from("website_sections").insert(rows as any);
    }
    return { pageId: copy.id };
  });

export const setPageStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      pageId: z.string().uuid(),
      status: pageStatusSchema,
      scheduledAt: z.string().datetime().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = { status: data.status, updated_by: userId };
    if (data.status === "published") patch.published_at = new Date().toISOString();
    if (data.status === "archived") patch.archived_at = new Date().toISOString();
    if (data.status === "scheduled") patch.scheduled_at = data.scheduledAt ?? new Date().toISOString();
    const { error } = await supabase.from("website_pages").update(patch as any).eq("id", data.pageId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- SECTIONS ----------------

export const upsertSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      sectionId: z.string().uuid().optional(),
      pageId: z.string().uuid(),
      organizationId: orgIdSchema,
      section_type: sectionTypeSchema,
      display_order: z.number().int().min(0).default(0),
      settings_json: z.record(z.string(), z.unknown()).default({}),
      content_json: z.record(z.string(), z.unknown()).default({}),
      visible: z.boolean().default(true),
      responsive_json: z.record(z.string(), z.unknown()).default({}),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.sectionId) {
      const { error } = await (supabase.from("website_sections") as any).update({
        section_type: data.section_type,
        display_order: data.display_order,
        settings_json: data.settings_json,
        content_json: data.content_json,
        visible: data.visible,
        responsive_json: data.responsive_json,
      }).eq("id", data.sectionId);
      if (error) throw new Error(error.message);
      return { sectionId: data.sectionId };
    }
    const { data: row, error } = await (supabase.from("website_sections") as any).insert({
      page_id: data.pageId,
      organization_id: data.organizationId,
      section_type: data.section_type,
      display_order: data.display_order,
      settings_json: data.settings_json,
      content_json: data.content_json,
      visible: data.visible,
      responsive_json: data.responsive_json,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { sectionId: row.id };
  });

export const reorderSections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      pageId: z.string().uuid(),
      orderedIds: z.array(z.string().uuid()).max(200),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    for (let i = 0; i < data.orderedIds.length; i++) {
      const { error } = await supabase
        .from("website_sections")
        .update({ display_order: i })
        .eq("id", data.orderedIds[i])
        .eq("page_id", data.pageId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sectionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("website_sections").delete().eq("id", data.sectionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- TEMPLATES ----------------

export const listTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ organizationId: orgIdSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("website_templates")
      .select("*")
      .or(`is_global.eq.true,organization_id.eq.${data.organizationId}`)
      .order("is_global", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { templates: rows ?? [] };
  });

export const useTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      templateId: z.string().uuid(),
      organizationId: orgIdSchema,
      title: z.string().min(1).max(200),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: tpl, error } = await supabase.from("website_templates").select("*").eq("id", data.templateId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!tpl) throw new Error("Template not found");
    const slug = slugify(data.title);
    const { data: page, error: pErr } = await supabase.from("website_pages").insert({
      organization_id: data.organizationId,
      title: data.title,
      slug,
      page_type: tpl.page_type,
      meta_title: data.title,
      created_by: userId,
      updated_by: userId,
    }).select("id").single();
    if (pErr) throw new Error(pErr.message);
    const sections = (tpl.default_sections_json as unknown as Array<{ section_type: string; settings_json?: unknown; content_json?: unknown }>).map((s, i) => ({
      page_id: page.id,
      organization_id: data.organizationId,
      section_type: s.section_type,
      display_order: i,
      settings_json: s.settings_json ?? {},
      content_json: s.content_json ?? {},
    }));
    if (sections.length > 0) await (supabase.from("website_sections") as any).insert(sections);
    return { pageId: page.id };
  });

// ---------------- BRAND SETTINGS ----------------

export const getBrandSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ organizationId: orgIdSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("website_brand_settings")
      .select("*")
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { brand: row };
  });

export const updateBrandSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      organizationId: orgIdSchema,
      patch: z.object({
        logo_url: z.string().url().nullable().optional(),
        favicon_url: z.string().url().nullable().optional(),
        primary_color: z.string().max(20).nullable().optional(),
        secondary_color: z.string().max(20).nullable().optional(),
        accent_color: z.string().max(20).nullable().optional(),
        heading_font: z.string().max(80).nullable().optional(),
        body_font: z.string().max(80).nullable().optional(),
        button_style: z.string().max(40).nullable().optional(),
        page_width: z.string().max(40).nullable().optional(),
        border_radius: z.string().max(40).nullable().optional(),
        seo_title_suffix: z.string().max(200).nullable().optional(),
        social_links: z.record(z.string(), z.string()).optional(),
        contact_info: z.record(z.string(), z.string()).optional(),
        footer_text: z.string().max(2000).nullable().optional(),
      }),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("website_brand_settings")
      .update(data.patch)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- SAVED SECTIONS ----------------

export const listSavedSections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ organizationId: orgIdSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("website_saved_sections")
      .select("*")
      .eq("organization_id", data.organizationId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { sections: rows ?? [] };
  });

export const saveSectionAsReusable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      organizationId: orgIdSchema,
      name: z.string().min(1).max(120),
      section_type: sectionTypeSchema,
      settings_json: z.record(z.string(), z.unknown()).default({}),
      content_json: z.record(z.string(), z.unknown()).default({}),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase.from("website_saved_sections") as any).insert({
      organization_id: data.organizationId,
      name: data.name,
      section_type: data.section_type,
      settings_json: data.settings_json,
      content_json: data.content_json,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSavedSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ savedSectionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("website_saved_sections").delete().eq("id", data.savedSectionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- DASHBOARD STATS ----------------

export const getWebsiteStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ organizationId: orgIdSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const counts = async (status?: string) => {
      let q = supabase.from("website_pages").select("id", { count: "exact", head: true }).eq("organization_id", data.organizationId);
      if (status) q = q.eq("status", status as any);
      const { count, error } = await q;
      if (error) throw new Error(error.message);
      return count ?? 0;
    };
    const [total, draft, published, scheduled] = await Promise.all([
      counts(), counts("draft"), counts("published"), counts("scheduled"),
    ]);
    const { data: recent } = await supabase
      .from("website_pages")
      .select("id,title,status,updated_at")
      .eq("organization_id", data.organizationId)
      .order("updated_at", { ascending: false })
      .limit(8);
    const { data: history } = await supabase
      .from("website_publish_history")
      .select("id,page_id,action,published_at")
      .eq("organization_id", data.organizationId)
      .order("published_at", { ascending: false })
      .limit(10);
    return { total, draft, published, scheduled, recent: recent ?? [], history: history ?? [] };
  });

// ---------------- PUBLISH HISTORY ----------------

export const getPagePublishHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ pageId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("website_publish_history")
      .select("id,page_id,action,published_at,published_by,version_snapshot_json")
      .eq("page_id", data.pageId)
      .order("published_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { history: rows ?? [] };
  });

export const restorePublishSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ historyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: snap, error } = await supabase
      .from("website_publish_history")
      .select("page_id, version_snapshot_json")
      .eq("id", data.historyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!snap) throw new Error("Snapshot not found");
    const v = snap.version_snapshot_json as Record<string, unknown>;
    const patch: Record<string, unknown> = {
      title: v.title,
      slug: v.slug,
      meta_title: v.meta_title,
      meta_description: v.meta_description,
      content_json: v.content_json,
      status: "draft",
      updated_by: userId,
    };
    const { error: uErr } = await supabase
      .from("website_pages")
      .update(patch as any)
      .eq("id", snap.page_id);
    if (uErr) throw new Error(uErr.message);
    return { pageId: snap.page_id };
  });
