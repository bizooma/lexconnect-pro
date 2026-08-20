import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  GUARDRAILS,

  SECTION_SPECS,
  isAiSectionType,
  aiUsageSnapshot,
  assertGenerationCooldown,
  callGateway,
  loadOrgContext,
  normalizePageType,
  releaseAiGeneration,
  reserveAiGeneration,
  revisionParameterSchema,
  logFailedGeneration,
  logGeneration,
  sectionContentSchema,
  sectionVocabularyText,
  sectionsParameterSchema,
  skeletonParameterSchema,
  slugify,
  validateSection,
  validateSectionContent,
  type GatewayUsage,
} from "@/lib/website-ai.server";


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

    assertGenerationCooldown(userId);
    const reservation = await reserveAiGeneration(supabase, data.organizationId);
    let committed = false;
    try {
    const orgContext = await loadOrgContext(supabase, data.organizationId);

    const system = [
      "You generate website page drafts for legal organizations (bar associations, legal aid, law firms). Be professional, concise, accessible. Use clear headings and short paragraphs.",
      `Allowed section_type values and the EXACT content_json fields each one accepts:\n${sectionVocabularyText()}`,
      "Each section's content_json must use ONLY the fields listed for that section_type. Do not add other fields. Do not output image URLs.",
      orgContext,
      GUARDRAILS,
    ].filter(Boolean).join("\n\n");

    const parameters = {
      type: "object",
      properties: {
        title: { type: "string" },
        slug: { type: "string" },
        page_type: { type: "string" },
        meta_title: { type: "string" },
        meta_description: { type: "string" },
        sections: sectionsParameterSchema(),
      },
      required: ["title", "slug", "page_type", "meta_title", "meta_description", "sections"],
    };

    const runOnce = async (userMessage: string) =>
      await callGateway({
        model,
        system,
        user: userMessage,
        toolName: "generate_page_draft",
        toolDescription: "Return a structured website page draft.",
        parameters,
      });

    let usage: GatewayUsage = { prompt_tokens: null, completion_tokens: null, total_tokens: null };
    let first = await runOnce(data.prompt);
    let output = first.output;
    usage = first.usage;
    let rawSections = Array.isArray(output.sections) ? output.sections : [];
    let validSections = rawSections
      .map((s: unknown) => validateSection(s))
      .filter((s): s is { section_type: string; content_json: Record<string, unknown> } => s !== null);

    if (validSections.length === 0) {
      const failed = rawSections
        .map((s) => String((s as { section_type?: unknown })?.section_type ?? "unknown"))
        .slice(0, 10);
      const reason = failed.length
        ? `These sections were rejected: ${failed.join(", ")}. They used an unknown section_type or fields that are not in the allowed field list.`
        : "No sections were returned.";
      const retry = await runOnce(
        `${data.prompt}\n\n${reason} Try again, using ONLY the allowed section_type values and their exact listed fields, with non-empty string values.`,
      );
      output = retry.output;
      usage = retry.usage;
      rawSections = Array.isArray(output.sections) ? output.sections : [];
      validSections = rawSections
        .map((s: unknown) => validateSection(s))
        .filter((s): s is { section_type: string; content_json: Record<string, unknown> } => s !== null);
      if (validSections.length === 0) {
        await logFailedGeneration(
          supabase, data.organizationId, userId, "page_draft", data.prompt, output,
        );
        throw new Error(
          "The AI couldn't produce a valid draft for that description. Try adding more specifics, or start from a template.",
        );
      }
    }

    const droppedSections = rawSections.length - validSections.length;

    const title = String(output.title || "Untitled page").slice(0, 200);
    const slug = slugify(String(output.slug || title));
    const pageType = normalizePageType(output.page_type);

    const metaTitle = String(output.meta_title || title).slice(0, 120);
    const metaDescription = String(output.meta_description || "").slice(0, 320);




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

    const rows = validSections.map((s, i) => ({
      page_id: pageRow.id,
      organization_id: data.organizationId,
      section_type: s.section_type,
      display_order: i,
      settings_json: {},
      content_json: s.content_json,
      visible: true,
      responsive_json: {},
    }));
    if (rows.length > 0) {
      const { error: secErr } = await (supabase.from("website_sections") as any).insert(rows);
      if (secErr) throw new Error(secErr.message);
    }

    await logGeneration(supabase, data.organizationId, userId, "page_draft", data.prompt, output, model, {
      usage,
      chargedTo: reservation.source,
    });
    committed = true;
    const snap = await aiUsageSnapshot(supabase, data.organizationId);

    return {
      pageId: pageRow.id as string,
      slug,
      droppedSections,
      remaining: snap.total_remaining,
      limit: snap.monthly_limit,
    };
    } finally {
      if (!committed) await releaseAiGeneration(supabase, data.organizationId, reservation.source);
    }
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

    const paramSchema = sectionContentSchema(section.section_type);
    if (!paramSchema) throw new Error("This section type cannot be generated by AI.");

    assertGenerationCooldown(userId);
    const reservation = await reserveAiGeneration(supabase, section.organization_id);
    let committed = false;
    try {
    const orgContext = await loadOrgContext(supabase, section.organization_id);

    const { output, usage } = await callGateway({
      model,
      system: [
        "You rewrite a single website section's content. Return only the fields defined for this section type. Be concise, professional, and on-brand for a legal organization. Never return image URLs.",
        orgContext,
        GUARDRAILS,
      ].filter(Boolean).join("\n\n"),
      user: `Section type: ${section.section_type}\nCurrent content: ${JSON.stringify(section.content_json)}\n\nInstruction: ${data.instruction}`,
      toolName: "rewrite_section",
      toolDescription: "Return updated content_json for the section.",
      parameters: paramSchema as Record<string, unknown>,
    });

    const clean = validateSectionContent(section.section_type, output);
    if (!clean) throw new Error("AI returned content that failed validation. Try rephrasing.");

    const merged = { ...(section.content_json as Record<string, unknown>), ...clean };
    const { error: upErr } = await (supabase.from("website_sections") as any)
      .update({ content_json: merged })
      .eq("id", data.sectionId);
    if (upErr) throw new Error(upErr.message);

    await logGeneration(supabase, section.organization_id, userId, "section_rewrite", data.instruction, output, model, {
      usage,
      chargedTo: reservation.source,
    });
    committed = true;
    const snap = await aiUsageSnapshot(supabase, section.organization_id);

    return {
      content_json: merged as Record<string, string>,
      remaining: snap.total_remaining,
      limit: snap.monthly_limit,
    };
    } finally {
      if (!committed) await releaseAiGeneration(supabase, section.organization_id, reservation.source);
    }
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

    assertGenerationCooldown(userId);
    const reservation = await reserveAiGeneration(supabase, page.organization_id);
    let committed = false;
    try {
    const orgContext = await loadOrgContext(supabase, page.organization_id);

    const { data: sections } = await supabase
      .from("website_sections")
      .select("section_type,content_json")
      .eq("page_id", data.pageId)
      .order("display_order", { ascending: true });

    const { output, usage } = await callGateway({
      model,
      system: [
        "You optimize SEO metadata for legal organization websites. Title 50–60 chars, description 140–160 chars, both keyword-rich and human-readable.",
        orgContext,
        GUARDRAILS,
      ].filter(Boolean).join("\n\n"),
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

    await logGeneration(supabase, page.organization_id, userId, "seo", page.title, output, model, {
      usage,
      chargedTo: reservation.source,
    });
    committed = true;
    const snap = await aiUsageSnapshot(supabase, page.organization_id);

    return {
      meta_title: String(output.meta_title ?? ""),
      meta_description: String(output.meta_description ?? ""),
      remaining: snap.total_remaining,
      limit: snap.monthly_limit,
    };
    } finally {
      if (!committed) await releaseAiGeneration(supabase, page.organization_id, reservation.source);
    }
  });

// ---------------- Generate from template + intake answers ----------------

export const generateFromTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      organizationId: z.string().uuid(),
      templateId: z.string().uuid(),
      answers: z.record(z.string(), z.string().trim().max(500)),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const model = "google/gemini-2.5-flash";

    const { data: allowed, error: permErr } = await supabase.rpc("can_edit_website", {
      _org: data.organizationId,
      _user: userId,
    });
    if (permErr) throw new Error(permErr.message);
    if (!allowed) throw new Error("You do not have permission to edit this website.");

    const { data: tpl, error: tplErr } = await supabase
      .from("website_templates")
      .select("id,name,page_type,default_sections_json,starter_prompt,intake_questions,is_global,organization_id")
      .eq("id", data.templateId)
      .maybeSingle();
    if (tplErr) throw new Error(tplErr.message);
    if (!tpl) throw new Error("Template not found");
    if (!tpl.is_global && tpl.organization_id !== data.organizationId) {
      throw new Error("Template not found");
    }

    const skeleton = (Array.isArray(tpl.default_sections_json) ? tpl.default_sections_json : [])
      .map((s) => (s as { section_type?: unknown }).section_type)
      .filter((t): t is string => typeof t === "string");
    const aiSkeleton = skeleton.filter((t) => isAiSectionType(t));
    if (aiSkeleton.length === 0) throw new Error("This template has no AI-generatable sections.");

    assertGenerationCooldown(userId);
    const reservation = await reserveAiGeneration(supabase, data.organizationId);
    let committed = false;
    try {
    const orgContext = await loadOrgContext(supabase, data.organizationId);

    const questions = (Array.isArray(tpl.intake_questions) ? tpl.intake_questions : []) as Array<{
      id?: string;
      label?: string;
    }>;
    const answerLines = questions
      .map((q) => {
        const val = q.id ? data.answers[q.id] : undefined;
        return val && val.trim() ? `${q.label ?? q.id}: ${val.trim()}` : null;
      })
      .filter(Boolean) as string[];
    // Include any extra answers not covered by the question list.
    const known = new Set(questions.map((q) => q.id).filter(Boolean) as string[]);
    for (const [k, v] of Object.entries(data.answers)) {
      if (!known.has(k) && v.trim()) answerLines.push(`${k}: ${v.trim()}`);
    }

    const structureSpec = aiSkeleton
      .map((t, i) => `s${i + 1} = ${t} — fields: ${Object.keys(SECTION_SPECS[t].properties).join(", ")}`)
      .join("\n");

    const { output, usage } = await callGateway({
      model,
      system: [
        "You generate website page drafts for legal organizations (bar associations, legal aid, law firms). Be professional, concise, accessible. Use clear headings and short paragraphs.",
        `Template: ${tpl.name}. ${tpl.starter_prompt ?? ""}`.trim(),
        `Fill one object per numbered key, in this order:\n${structureSpec}`,
        "Use ONLY the fields listed for each key. Do not output image URLs. Base all facts on the intake answers and organization context.",
        orgContext,
        GUARDRAILS,
      ].filter(Boolean).join("\n\n"),
      user: `Intake answers:\n${answerLines.join("\n") || "(none provided)"}`,
      toolName: "generate_page_from_template",
      toolDescription: "Return a structured website page draft matching the template structure.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          slug: { type: "string" },
          meta_title: { type: "string" },
          meta_description: { type: "string" },
          ...(skeletonParameterSchema(aiSkeleton).properties as Record<string, unknown>),
        },
        required: [
          "title",
          "slug",
          "meta_title",
          "meta_description",
          ...aiSkeleton.map((_, i) => `s${i + 1}`),
        ],
      },
    });

    const title = String(output.title || tpl.name).slice(0, 200);
    const slug = slugify(String(output.slug || title));
    const metaTitle = String(output.meta_title || title).slice(0, 120);
    const metaDescription = String(output.meta_description || "").slice(0, 320);

    // Map s1..sN back onto the skeleton's section types by position.
    const validSections: Array<{ section_type: string; content_json: Record<string, unknown> }> = [];
    let droppedSections = 0;
    aiSkeleton.forEach((type, i) => {
      const clean = validateSectionContent(type, output[`s${i + 1}`] ?? {});
      if (!clean) {
        droppedSections++;
        return;
      }
      validSections.push({ section_type: type, content_json: clean });
    });

    if (validSections.length === 0) {
      await logFailedGeneration(
        supabase, data.organizationId, userId, "template_draft",
        `template:${tpl.name} ${JSON.stringify(data.answers)}`.slice(0, 2000), output,
      );
      throw new Error(
        "The AI couldn't produce a valid draft for that description. Try adding more specifics, or start from a template.",
      );
    }



    const { data: pageRow, error: pageErr } = await (supabase.from("website_pages") as any)
      .insert({
        organization_id: data.organizationId,
        title,
        slug,
        page_type: tpl.page_type,
        status: "draft",
        meta_title: metaTitle,
        meta_description: metaDescription,
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();
    if (pageErr) throw new Error(pageErr.message);

    const rows = validSections.map((s, i) => ({
      page_id: pageRow.id,
      organization_id: data.organizationId,
      section_type: s.section_type,
      display_order: i,
      settings_json: {},
      content_json: s.content_json,
      visible: true,
      responsive_json: {},
    }));
    if (rows.length > 0) {
      const { error: secErr } = await (supabase.from("website_sections") as any).insert(rows);
      if (secErr) throw new Error(secErr.message);
    }

    await logGeneration(
      supabase,
      data.organizationId,
      userId,
      "page_draft",
      `[Template: ${tpl.name}] ${answerLines.join(" | ")}`.slice(0, 2000),
      output,
      model,
      { usage, chargedTo: reservation.source },
    );
    committed = true;
    const snap = await aiUsageSnapshot(supabase, data.organizationId);

    return {
      pageId: pageRow.id as string,
      slug,
      droppedSections,
      remaining: snap.total_remaining,
      limit: snap.monthly_limit,
    };
    } finally {
      if (!committed) await releaseAiGeneration(supabase, data.organizationId, reservation.source);
    }
  });

// ---------------- Monthly quota (read-only) ----------------

export const getAiQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const snap = await aiUsageSnapshot(supabase, data.organizationId);
    return {
      used: snap.monthly_used,
      limit: snap.monthly_limit,
      remaining: snap.total_remaining,
      purchased: snap.purchased_balance,
      period: snap.period,
      resetsOn: snap.resets_on,
    };
  });

// ---------------- Page-level AI revision ----------------

const FROZEN_TYPES = new Set(["custom_html", "video"]);

type EditorSection = {
  id: string;
  section_type: string;
  content_json: Record<string, unknown>;
  display_order: number;
  visible: boolean;
  settings_json?: Record<string, unknown>;
  responsive_json?: Record<string, unknown>;
};

export const revisePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      pageId: z.string().uuid(),
      instruction: z.string().min(5).max(1000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const model = "google/gemini-2.5-flash";

    const { data: page, error: pageErr } = await supabase
      .from("website_pages")
      .select("id,organization_id,title,page_type")
      .eq("id", data.pageId)
      .single();
    if (pageErr || !page) throw new Error(pageErr?.message || "Page not found");

    const { data: sectionRows, error: secErr } = await supabase
      .from("website_sections")
      .select("id,section_type,content_json,display_order,visible,settings_json,responsive_json")
      .eq("page_id", data.pageId)
      .order("display_order", { ascending: true });
    if (secErr) throw new Error(secErr.message);
    const existing = (sectionRows ?? []) as unknown as EditorSection[];
    if (existing.length === 0) throw new Error("This page has no sections to revise yet.");

    assertGenerationCooldown(userId);
    const reservation = await reserveAiGeneration(supabase, page.organization_id);
    let committed = false;
    try {
    const orgContext = await loadOrgContext(supabase, page.organization_id);

    const structure = existing
      .map((s, i) =>
        `${i + 1}. id=${s.id} type=${s.section_type}${FROZEN_TYPES.has(s.section_type) ? " (LOCKED: keep as-is, may be reordered)" : ""} content=${JSON.stringify(s.content_json).slice(0, 900)}`,
      )
      .join("\n");

    const system = [
      "You revise an existing website page for a legal organization. Return the FULL revised page as an ordered array of sections.",
      "For a section you keep, set ref to its existing id and return its (possibly rewritten) content. For a brand-new section, set ref to \"new\". Omit a section only if the instruction clearly asks to remove it. Never omit LOCKED sections; you may reorder them.",
      `Allowed section_type values and the EXACT content_json fields each one accepts:\n${sectionVocabularyText()}`,
      "Use ONLY the fields listed for that section_type. Never output image URLs.",
      orgContext,
      GUARDRAILS,
    ].filter(Boolean).join("\n\n");

    const { output, usage } = await callGateway({
      model,
      system,
      user: `Page: ${page.title} (${page.page_type})\n\nCurrent sections in order:\n${structure}\n\nInstruction: ${data.instruction}`,
      toolName: "revise_page",
      toolDescription: "Return the full revised ordered list of page sections.",
      parameters: revisionParameterSchema(),
    });

    const returned = Array.isArray(output.sections) ? output.sections : [];
    const byId = new Map(existing.map((s) => [s.id, s]));

    type Planned =
      | { kind: "keep"; section: EditorSection; content: Record<string, unknown> }
      | { kind: "new"; section_type: string; content: Record<string, unknown> };

    const planned: Planned[] = [];
    const seen = new Set<string>();
    let dropped = 0;

    for (const raw of returned) {
      const item = raw as { ref?: unknown; section_type?: unknown; content_json?: unknown };
      const ref = typeof item.ref === "string" ? item.ref.trim() : "";
      const current = byId.get(ref);
      if (current) {
        if (seen.has(current.id)) continue;
        seen.add(current.id);
        if (FROZEN_TYPES.has(current.section_type)) {
          planned.push({ kind: "keep", section: current, content: current.content_json });
          continue;
        }
        const clean = validateSectionContent(current.section_type, item.content_json ?? {});
        planned.push({
          kind: "keep",
          section: current,
          content: clean
            ? { ...(current.content_json ?? {}), ...clean }
            : (current.content_json ?? {}),
        });
        if (!clean) dropped++;
        continue;
      }
      const valid = validateSection(item);
      if (!valid) {
        dropped++;
        continue;
      }
      planned.push({ kind: "new", section_type: valid.section_type, content: valid.content_json });
    }

    if (planned.length === 0) {
      await logFailedGeneration(
        supabase, page.organization_id, userId, "page_draft", data.instruction, output,
      );
      throw new Error(
        "The AI couldn't apply that change. Try being more specific about which sections to change.",
      );
    }

    // Re-insert any LOCKED section the model dropped, at its original relative position.
    for (const s of existing) {
      if (!FROZEN_TYPES.has(s.section_type) || seen.has(s.id)) continue;
      let idx = planned.length;
      for (let i = 0; i < planned.length; i++) {
        const p = planned[i];
        if (p.kind === "keep" && p.section.display_order > s.display_order) {
          idx = i;
          break;
        }
      }
      planned.splice(idx, 0, { kind: "keep", section: s, content: s.content_json });
      seen.add(s.id);
    }

    // Snapshot BEFORE applying.
    const { data: revRow, error: revErr } = await (supabase.from("website_page_revisions") as any)
      .insert({
        page_id: data.pageId,
        organization_id: page.organization_id,
        sections_json: existing,
        reason: data.instruction.slice(0, 500),
        created_by: userId,
      })
      .select("id")
      .single();
    if (revErr) throw new Error(revErr.message);

    // Apply: updates, inserts, deletions.
    let order = 0;
    for (const p of planned) {
      if (p.kind === "keep") {
        const { error } = await (supabase.from("website_sections") as any)
          .update({ content_json: p.content, display_order: order })
          .eq("id", p.section.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await (supabase.from("website_sections") as any).insert({
          page_id: data.pageId,
          organization_id: page.organization_id,
          section_type: p.section_type,
          display_order: order,
          settings_json: {},
          content_json: p.content,
          visible: true,
          responsive_json: {},
        });
        if (error) throw new Error(error.message);
      }
      order++;
    }

    const removed = existing.filter((s) => !seen.has(s.id)).map((s) => s.id);
    if (removed.length > 0) {
      const { error } = await supabase.from("website_sections").delete().in("id", removed);
      if (error) throw new Error(error.message);
    }

    await logGeneration(
      supabase, page.organization_id, userId, "page_draft",
      `[Revision] ${data.instruction}`.slice(0, 2000), output, model,
      { usage, chargedTo: reservation.source },
    );
    committed = true;
    const snap = await aiUsageSnapshot(supabase, page.organization_id);

    return {
      revisionId: revRow.id as string,
      dropped,
      removed: removed.length,
      remaining: snap.total_remaining,
      limit: snap.monthly_limit,
    };
    } finally {
      if (!committed) await releaseAiGeneration(supabase, page.organization_id, reservation.source);
    }
  });

/** Restore a page's sections from a revision snapshot (undo one AI revision). */
export const revertPageRevision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ revisionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rev, error } = await supabase
      .from("website_page_revisions")
      .select("id,page_id,organization_id,sections_json")
      .eq("id", data.revisionId)
      .single();
    if (error || !rev) throw new Error(error?.message || "Revision not found");

    const snapshot = (Array.isArray(rev.sections_json) ? rev.sections_json : []) as unknown as EditorSection[];
    if (snapshot.length === 0) throw new Error("This revision has no snapshot to restore.");

    const { error: delErr } = await supabase
      .from("website_sections")
      .delete()
      .eq("page_id", rev.page_id);
    if (delErr) throw new Error(delErr.message);

    const rows = snapshot.map((s, i) => ({
      id: s.id,
      page_id: rev.page_id,
      organization_id: rev.organization_id,
      section_type: s.section_type,
      display_order: s.display_order ?? i,
      settings_json: s.settings_json ?? {},
      content_json: s.content_json ?? {},
      visible: s.visible ?? true,
      responsive_json: s.responsive_json ?? {},
    }));
    const { error: insErr } = await (supabase.from("website_sections") as any).insert(rows);
    if (insErr) throw new Error(insErr.message);

    return { ok: true, pageId: rev.page_id as string };
  });

// ---------------- Build my site (multi-page draft run) ----------------

export const generateSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        profile: z.object({
          founded_year: z.number().int().min(1700).max(2100).nullable().optional(),
          region: z.string().trim().max(120).nullable().optional(),
          audience: z.enum(["members", "public", "both"]).nullable().optional(),
          tone: z.enum(["professional", "warm", "modern"]).nullable().optional(),
          primary_goal: z.string().trim().max(200).nullable().optional(),
          programs: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
          contact: z.record(z.string(), z.string().trim().max(200)).optional(),
          notes: z.string().trim().max(1000).nullable().optional(),
        }),
        pages: z
          .array(
            z.object({
              key: z.string().min(1).max(60),
              title: z.string().trim().min(2).max(120),
              mode: z.enum(["template", "freeform", "module_intro"]),
              templateName: z.string().trim().max(120).optional(),
              brief: z.string().trim().max(1000).optional(),
              moduleTarget: z.enum(["sponsors", "wellbeing"]).optional(),
            }),
          )
          .min(1)
          .max(8),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { buildSite } = await import("@/lib/website-site-builder.server");
    return await buildSite({
      supabase: context.supabase,
      userId: context.userId,
      organizationId: data.organizationId,
      profile: data.profile,
      pages: data.pages,
    });
  });
