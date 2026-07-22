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

    // AUTO-LINK: contacts without user_id whose email matches an active member.
    // Use admin client to look up user emails; row is already org-scoped + admin-guarded.
    const unlinked = rows.filter((r) => !r.user_id);
    if (unlinked.length > 0 && activeMemberIds.size > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const memberList = Array.from(activeMemberIds);
      const emailToUserId = new Map<string, string>();
      await Promise.all(
        memberList.map(async (uid) => {
          try {
            const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
            const em = u?.user?.email?.toLowerCase();
            if (em) emailToUserId.set(em, uid);
          } catch {
            /* noop */
          }
        }),
      );
      const patches: { id: string; user_id: string }[] = [];
      for (const c of unlinked) {
        const match = emailToUserId.get(String(c.email ?? "").toLowerCase());
        if (match) {
          patches.push({ id: c.id, user_id: match });
        }
      }
      if (patches.length > 0) {
        await Promise.all(
          patches.map((p) =>
            supabaseAdmin
              .from("org_contacts")
              .update({ user_id: p.user_id })
              .eq("id", p.id)
              .eq("organization_id", data.organizationId),
          ),
        );
        // reflect in local rows
        const patchMap = new Map(patches.map((p) => [p.id, p.user_id]));
        for (const r of rows) {
          const linked = patchMap.get(r.id);
          if (linked) r.user_id = linked;
        }
      }
    }

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
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "done" || data.status === "dismissed") {
      patch.completed_at = new Date().toISOString();
    } else {
      patch.completed_at = null;
    }
    const { error } = await supabase
      .from("org_follow_ups")
      .update(patch)
      .eq("id", data.followUpId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
