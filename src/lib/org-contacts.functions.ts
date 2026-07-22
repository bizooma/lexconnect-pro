import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

async function assertOrgAdmin(supabase: any, userId: string, orgId: string) {
  const { data, error } = await supabase.rpc("is_org_admin", { _org: orgId, _user: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────────────────

const listSchema = z.object({
  organizationId: uuid,
  search: z.string().trim().max(120).optional().default(""),
  tag: z.string().trim().max(40).optional().default(""),
  status: z.enum(["all", "member", "invited", "contact"]).optional().default("all"),
  page: z.number().int().min(0).max(1000).optional().default(0),
});

export type ContactRow = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  external_ref: string | null;
  user_id: string | null;
  invited_at: string | null;
  created_at: string;
  updated_at: string;
  tags: string[];
  last_note_at: string | null;
  status: "member" | "invited" | "contact";
};

export const listContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgAdmin(supabase, userId, data.organizationId);

    const PAGE = 50;
    const from = data.page * PAGE;
    const to = from + PAGE - 1;

    let q = supabase
      .from("org_contacts")
      .select("id,email,full_name,phone,external_ref,user_id,invited_at,created_at,updated_at", { count: "exact" })
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (data.search) {
      const s = data.search.replace(/[%_]/g, "\\$&");
      q = q.or(`email.ilike.%${s}%,full_name.ilike.%${s}%`);
    }

    const { data: contacts, count, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (contacts ?? []) as any[];
    const contactIds = rows.map((r) => r.id);

    const [tagsRes, notesRes, membersRes] = await Promise.all([
      contactIds.length
        ? supabase
            .from("org_contact_tags")
            .select("contact_id,tag")
            .in("contact_id", contactIds)
        : Promise.resolve({ data: [], error: null }),
      contactIds.length
        ? supabase
            .from("org_contact_notes")
            .select("contact_id,created_at")
            .in("contact_id", contactIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", data.organizationId)
        .eq("status", "active"),
    ]);

    const tagMap = new Map<string, string[]>();
    ((tagsRes.data ?? []) as { contact_id: string; tag: string }[]).forEach((t) => {
      const arr = tagMap.get(t.contact_id) ?? [];
      arr.push(t.tag);
      tagMap.set(t.contact_id, arr);
    });

    const lastNoteMap = new Map<string, string>();
    ((notesRes.data ?? []) as { contact_id: string; created_at: string }[]).forEach((n) => {
      if (!lastNoteMap.has(n.contact_id)) lastNoteMap.set(n.contact_id, n.created_at);
    });

    const activeMemberIds = new Set(
      ((membersRes.data ?? []) as { user_id: string | null }[]).map((m) => m.user_id).filter(Boolean) as string[],
    );

    // AUTO-LINK: rely on the SQL helper (single statement, admin-guarded).
    // Fire-and-forget from the caller side; here we just skip the loop.
    // The route also calls linkOrgContacts() on load and after imports.


    const result: ContactRow[] = rows.map((r) => {
      const tags = (tagMap.get(r.id) ?? []).sort();
      const isMember = r.user_id && activeMemberIds.has(r.user_id);
      const status: ContactRow["status"] = isMember
        ? "member"
        : r.invited_at
        ? "invited"
        : "contact";
      return {
        ...r,
        tags,
        last_note_at: lastNoteMap.get(r.id) ?? null,
        status,
      } as ContactRow;
    });

    // Client-side filters that depend on joined data
    const filtered = result.filter((r) => {
      if (data.status !== "all" && r.status !== data.status) return false;
      if (data.tag && !r.tags.includes(data.tag)) return false;
      return true;
    });

    // Distinct tag list for the current org (for filter dropdown)
    const { data: allTags } = await supabase
      .from("org_contact_tags")
      .select("tag")
      .eq("organization_id", data.organizationId);
    const tagOptions = Array.from(
      new Set(((allTags ?? []) as { tag: string }[]).map((t) => t.tag)),
    ).sort();

    return {
      rows: filtered,
      total: count ?? 0,
      pageSize: PAGE,
      tagOptions,
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// ADD
// ─────────────────────────────────────────────────────────────────────────────

const addSchema = z.object({
  organizationId: uuid,
  email: z.string().trim().toLowerCase().email().max(255),
  full_name: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  external_ref: z.string().trim().max(120).optional().nullable(),
});

export const addContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => addSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgAdmin(supabase, userId, data.organizationId);

    const { data: row, error } = await supabase
      .from("org_contacts")
      .insert({
        organization_id: data.organizationId,
        email: data.email,
        full_name: data.full_name || null,
        phone: data.phone || null,
        external_ref: data.external_ref || null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL
// ─────────────────────────────────────────────────────────────────────────────

export const getContactDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: uuid, contactId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgAdmin(supabase, userId, data.organizationId);

    const [contactRes, tagsRes, notesRes, interactionsRes, followUpsRes, adminsRes] = await Promise.all([
      supabase
        .from("org_contacts")
        .select("*")
        .eq("id", data.contactId)
        .eq("organization_id", data.organizationId)
        .single(),
      supabase
        .from("org_contact_tags")
        .select("id,tag,created_at")
        .eq("contact_id", data.contactId)
        .order("tag", { ascending: true }),
      supabase
        .from("org_contact_notes")
        .select("id,body,author_id,created_at")
        .eq("contact_id", data.contactId)
        .order("created_at", { ascending: false }),
      supabase
        .from("org_contact_interactions")
        .select("id,kind,note,occurred_at,created_by,created_at")
        .eq("contact_id", data.contactId)
        .order("occurred_at", { ascending: false }),
      supabase
        .from("org_follow_ups")
        .select("id,title,due_at,assigned_to,status,created_by,created_at,completed_at")
        .eq("contact_id", data.contactId)
        .order("created_at", { ascending: false }),
      supabase
        .from("organization_members")
        .select("user_id, org_role, profiles!organization_members_user_id_fkey(full_name)")
        .eq("organization_id", data.organizationId)
        .eq("status", "active")
        .in("org_role", ["owner", "admin"]),
    ]);

    if (contactRes.error) throw new Error(contactRes.error.message);

    // Resolve author/creator names for display
    const userIds = new Set<string>();
    ((notesRes.data ?? []) as any[]).forEach((n) => n.author_id && userIds.add(n.author_id));
    ((interactionsRes.data ?? []) as any[]).forEach((i) => i.created_by && userIds.add(i.created_by));
    ((followUpsRes.data ?? []) as any[]).forEach((f) => {
      if (f.created_by) userIds.add(f.created_by);
      if (f.assigned_to) userIds.add(f.assigned_to);
    });

    const nameMap = new Map<string, string>();
    if (userIds.size > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", Array.from(userIds));
      ((profs ?? []) as { user_id: string; full_name: string | null }[]).forEach((p) => {
        if (p.full_name) nameMap.set(p.user_id, p.full_name);
      });
    }

    // Admins list — flatten profile join
    const admins = ((adminsRes.data ?? []) as any[]).map((a) => ({
      user_id: a.user_id as string,
      name: (a.profiles?.full_name as string | null) ?? "Admin",
    }));

    return {
      contact: contactRes.data,
      tags: (tagsRes.data ?? []) as { id: string; tag: string; created_at: string }[],
      notes: ((notesRes.data ?? []) as any[]).map((n) => ({
        ...n,
        author_name: nameMap.get(n.author_id) ?? "Someone",
      })),
      interactions: ((interactionsRes.data ?? []) as any[]).map((i) => ({
        ...i,
        creator_name: nameMap.get(i.created_by) ?? "Someone",
      })),
      followUps: ((followUpsRes.data ?? []) as any[]).map((f) => ({
        ...f,
        assignee_name: f.assigned_to ? nameMap.get(f.assigned_to) ?? "Assigned" : null,
        creator_name: nameMap.get(f.created_by) ?? "Someone",
      })),
      admins,
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// TAGS
// ─────────────────────────────────────────────────────────────────────────────

export const addContactTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      organizationId: uuid,
      contactId: uuid,
      tag: z.string().trim().min(1).max(40),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgAdmin(supabase, userId, data.organizationId);
    const { error } = await supabase.from("org_contact_tags").insert({
      organization_id: data.organizationId,
      contact_id: data.contactId,
      tag: data.tag,
      created_by: userId,
    });
    if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
    return { ok: true };
  });

export const removeContactTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organizationId: uuid, tagId: uuid }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgAdmin(supabase, userId, data.organizationId);
    const { error } = await supabase
      .from("org_contact_tags")
      .delete()
      .eq("id", data.tagId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────────────────────
// NOTES
// ─────────────────────────────────────────────────────────────────────────────

export const addContactNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      organizationId: uuid,
      contactId: uuid,
      body: z.string().trim().min(1).max(5000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgAdmin(supabase, userId, data.organizationId);
    const { error } = await supabase.from("org_contact_notes").insert({
      organization_id: data.organizationId,
      contact_id: data.contactId,
      body: data.body,
      author_id: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const addContactInteraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      organizationId: uuid,
      contactId: uuid,
      kind: z.enum(["call", "email", "meeting", "event", "other"]),
      note: z.string().trim().max(5000).optional().nullable(),
      occurred_at: z.string().datetime().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgAdmin(supabase, userId, data.organizationId);
    const { error } = await supabase.from("org_contact_interactions").insert({
      organization_id: data.organizationId,
      contact_id: data.contactId,
      kind: data.kind,
      note: data.note || null,
      occurred_at: data.occurred_at ?? new Date().toISOString(),
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────────────────────
// FOLLOW-UPS
// ─────────────────────────────────────────────────────────────────────────────

export const addFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      organizationId: uuid,
      contactId: uuid,
      title: z.string().trim().min(1).max(200),
      due_at: z.string().datetime().optional().nullable(),
      assigned_to: uuid.optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgAdmin(supabase, userId, data.organizationId);
    const { error } = await supabase.from("org_follow_ups").insert({
      organization_id: data.organizationId,
      contact_id: data.contactId,
      title: data.title,
      due_at: data.due_at || null,
      assigned_to: data.assigned_to || null,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateFollowUpStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      organizationId: uuid,
      followUpId: uuid,
      status: z.enum(["open", "done", "dismissed"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgAdmin(supabase, userId, data.organizationId);
    const completed_at =
      data.status === "open" ? null : new Date().toISOString();
    const { error } = await supabase
      .from("org_follow_ups")
      .update({ status: data.status, completed_at })
      .eq("id", data.followUpId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────────────────────
// ENGAGEMENT (linked members only) — metadata-only, org-scoped
// ─────────────────────────────────────────────────────────────────────────────

export type MemberEngagement = {
  linked: boolean;
  lastSignInAt: string | null;
  mentorship: { active: number; completed: number; lastActivityAt: string | null };
  ce: {
    enrollments: { courseTitle: string; status: string; creditHours: number; completedAt: string | null }[];
    totalCredits: number;
  };
  qa: { posts: number; replies: number };
  messaging: { conversations: number; lastActivityAt: string | null };
};

export const getMemberEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organizationId: uuid, contactId: uuid }).parse(d),
  )
  .handler(async ({ data, context }): Promise<MemberEngagement> => {
    const { supabase, userId } = context;
    await assertOrgAdmin(supabase, userId, data.organizationId);

    // Resolve contact → linked user, scoped to this org.
    const { data: contact, error: cErr } = await supabase
      .from("org_contacts")
      .select("user_id")
      .eq("id", data.contactId)
      .eq("organization_id", data.organizationId)
      .single();
    if (cErr) throw new Error(cErr.message);
    const linkedUserId = (contact as any)?.user_id as string | null;
    if (!linkedUserId) {
      return {
        linked: false,
        lastSignInAt: null,
        mentorship: { active: 0, completed: 0, lastActivityAt: null },
        ce: { enrollments: [], totalCredits: 0 },
        qa: { posts: 0, replies: 0 },
        messaging: { conversations: 0, lastActivityAt: null },
      };
    }

    const orgId = data.organizationId;

    // Only fetch lastSignInAt when the linked user is an ACTIVE member of this org.
    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("user_id", linkedUserId)
      .eq("status", "active")
      .maybeSingle();
    const isActiveMember = !!membership;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Last sign-in from auth admin — ACTIVE-member gated.
    let lastSignInAt: string | null = null;
    if (isActiveMember) {
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(linkedUserId);
        lastSignInAt = (u?.user as any)?.last_sign_in_at ?? null;
      } catch {
        /* noop */
      }
    }


    // Mentorship — org-scoped
    const { data: mentorships } = await supabase
      .from("mentorships")
      .select("status,updated_at")
      .eq("organization_id", orgId)
      .or(`mentor_id.eq.${linkedUserId},mentee_id.eq.${linkedUserId}`);
    const mRows = (mentorships ?? []) as { status: string; updated_at: string }[];
    const mActive = mRows.filter((r) => r.status === "active").length;
    const mCompleted = mRows.filter((r) => r.status === "completed").length;
    const mLast = mRows.reduce<string | null>(
      (acc, r) => (!acc || r.updated_at > acc ? r.updated_at : acc),
      null,
    );

    // CE — enrollments joined to org's courses
    const { data: enrollments } = await supabase
      .from("ce_enrollments")
      .select("status,completed_at,ce_courses!inner(title,credit_hours,organization_id)")
      .eq("user_id", linkedUserId)
      .eq("ce_courses.organization_id", orgId);
    const eRows = ((enrollments ?? []) as any[]).map((e) => ({
      courseTitle: e.ce_courses?.title ?? "Course",
      status: e.status as string,
      creditHours: Number(e.ce_courses?.credit_hours ?? 0),
      completedAt: (e.completed_at as string | null) ?? null,
    }));
    const totalCredits = eRows
      .filter((e) => e.status === "completed")
      .reduce((s, e) => s + e.creditHours, 0);

    // Q&A — org-scoped counts
    const [{ count: postCount }, { count: replyCount }] = await Promise.all([
      supabase
        .from("qa_posts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("author_id", linkedUserId),
      supabase
        .from("qa_replies")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("author_id", linkedUserId),
    ]);

    // Messaging — count + last activity only, org-scoped, via admin to bypass
    // participant-scoped RLS. Never returns titles, bodies, or participants.
    let convCount = 0;
    let convLast: string | null = null;
    try {
      const { data: parts } = await supabaseAdmin
        .from("conversation_participants")
        .select("conversation_id, conversations!inner(organization_id,last_message_at)")
        .eq("user_id", linkedUserId)
        .eq("conversations.organization_id", orgId);
      const rows = (parts ?? []) as any[];
      convCount = rows.length;
      convLast = rows.reduce<string | null>(
        (acc, r) => {
          const ts = r.conversations?.last_message_at ?? null;
          return !acc || (ts && ts > acc) ? ts : acc;
        },
        null,
      );
    } catch {
      /* noop */
    }

    return {
      linked: true,
      lastSignInAt,
      mentorship: { active: mActive, completed: mCompleted, lastActivityAt: mLast },
      ce: { enrollments: eRows, totalCredits },
      qa: { posts: postCount ?? 0, replies: replyCount ?? 0 },
      messaging: { conversations: convCount, lastActivityAt: convLast },
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// LINK (backfill user_id via SQL helper)
// ─────────────────────────────────────────────────────────────────────────────

export const linkOrgContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: n, error } = await supabase.rpc("link_org_contacts", {
      _org: data.organizationId,
    });
    if (error) throw new Error(error.message);
    return { linked: Number(n ?? 0) };
  });

// ─────────────────────────────────────────────────────────────────────────────
// CSV IMPORT (batch)
// ─────────────────────────────────────────────────────────────────────────────

const importRowSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  full_name: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  external_ref: z.string().trim().max(120).optional().nullable(),
});

const importSchema = z.object({
  organizationId: uuid,
  rows: z.array(z.record(z.string(), z.any())).max(100),
});

export const importContactsBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => importSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgAdmin(supabase, userId, data.organizationId);

    let invalid = 0;
    const parsed: z.infer<typeof importRowSchema>[] = [];
    for (const raw of data.rows) {
      const r = importRowSchema.safeParse(raw);
      if (r.success) parsed.push(r.data);
      else invalid++;
    }
    if (parsed.length === 0) {
      return { imported: 0, skippedDuplicates: 0, invalid };
    }

    const emails = Array.from(new Set(parsed.map((r) => r.email)));
    const { data: existing, error: exErr } = await supabase
      .from("org_contacts")
      .select("email")
      .eq("organization_id", data.organizationId)
      .in("email", emails);
    if (exErr) throw new Error(exErr.message);
    const existingSet = new Set(
      ((existing ?? []) as { email: string }[]).map((r) => r.email.toLowerCase()),
    );

    const toInsert: any[] = [];
    const seen = new Set<string>();
    let skippedDuplicates = 0;
    for (const r of parsed) {
      if (existingSet.has(r.email) || seen.has(r.email)) {
        skippedDuplicates++;
        continue;
      }
      seen.add(r.email);
      toInsert.push({
        organization_id: data.organizationId,
        email: r.email,
        full_name: r.full_name || null,
        phone: r.phone || null,
        external_ref: r.external_ref || null,
        created_by: userId,
      });
    }

    let imported = 0;
    if (toInsert.length > 0) {
      const { data: ins, error: insErr } = await supabase
        .from("org_contacts")
        .insert(toInsert)
        .select("id");
      if (insErr) throw new Error(insErr.message);
      imported = (ins ?? []).length;
    }

    return { imported, skippedDuplicates, invalid };
  });

// ─────────────────────────────────────────────────────────────────────────────
// BULK INVITE (uses existing organization_invites + email queue)
// ─────────────────────────────────────────────────────────────────────────────

const bulkInviteSchema = z.object({
  organizationId: uuid,
  contactIds: z.array(uuid).min(1).max(200),
  org_role: z.enum(["member", "content_editor", "admin"]).optional().default("member"),
  siteUrl: z.string().url().max(500),
  siteName: z.string().trim().max(120).optional().default("the organization"),
});

export const bulkInviteContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bulkInviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgAdmin(supabase, userId, data.organizationId);

    const { data: contacts, error: cErr } = await supabase
      .from("org_contacts")
      .select("id,email,user_id,invited_at")
      .eq("organization_id", data.organizationId)
      .in("id", data.contactIds);
    if (cErr) throw new Error(cErr.message);

    const eligible = ((contacts ?? []) as any[]).filter(
      (c) => c.email && !c.user_id,
    );

    // Skip contacts that already have a pending invite for this org.
    const emails = eligible.map((c) => c.email.toLowerCase());
    let alreadyInvitedSet = new Set<string>();
    if (emails.length > 0) {
      const { data: existing } = await supabase
        .from("organization_invites")
        .select("email")
        .eq("organization_id", data.organizationId)
        .is("accepted_at", null)
        .in("email", emails);
      alreadyInvitedSet = new Set(
        ((existing ?? []) as { email: string }[]).map((r) => r.email.toLowerCase()),
      );
    }

    let invited = 0;
    let skipped = 0;
    let queued = 0;
    let queueFailed = 0;

    for (const c of eligible) {
      const email = String(c.email).toLowerCase();
      if (alreadyInvitedSet.has(email)) {
        skipped++;
        continue;
      }
      const token = (globalThis.crypto?.randomUUID?.() ?? "").replace(/-/g, "")
        || Array.from({ length: 32 }, () =>
             Math.floor(Math.random() * 16).toString(16)).join("");
      const { error: invErr } = await supabase.from("organization_invites").insert({
        organization_id: data.organizationId,
        email,
        org_role: data.org_role,
        token,
        invited_by: userId,
      });
      if (invErr) {
        skipped++;
        continue;
      }
      invited++;

      const confirmationUrl = `${data.siteUrl.replace(/\/$/, "")}/accept-invite/${token}`;

      // Render the invite email server-side; the queue processor expects
      // pre-rendered html/text/subject/from, not template_name lookups.
      const [{ render }, React, { TEMPLATES }] = await Promise.all([
        import("@react-email/components"),
        import("react"),
        import("@/lib/email-templates/registry"),
      ]);
      const template = TEMPLATES.invite;
      const templateData = {
        siteName: data.siteName,
        siteUrl: data.siteUrl,
        confirmationUrl,
      };
      const element = React.createElement(template.component as any, templateData);
      const html = await render(element);
      const text = await render(element, { plainText: true });
      const subject =
        typeof template.subject === "function"
          ? template.subject(templateData)
          : template.subject;
      const senderDomain = process.env.EMAIL_SENDER_DOMAIN || "lexguild.com";

      const { error: qErr } = await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          message_id: (globalThis.crypto?.randomUUID?.() ?? token),
          to: email,
          from: `${data.siteName} <noreply@${senderDomain}>`,
          sender_domain: senderDomain,
          subject,
          html,
          text,
          purpose: "transactional",
          label: "invite",
          queued_at: new Date().toISOString(),
        },
      });
      if (qErr) queueFailed++;
      else queued++;

      await supabase
        .from("org_contacts")
        .update({ invited_at: new Date().toISOString() })
        .eq("id", c.id)
        .eq("organization_id", data.organizationId);
    }

    return {
      invited,
      queued,
      skipped: skipped + (contacts?.length ?? 0) - eligible.length,
      queueFailed,
    };
  });
