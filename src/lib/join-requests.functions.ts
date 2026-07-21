import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getEffectiveHost } from "@/lib/website-host.server";

const RESERVED_HOST_SUFFIXES = ["lexguild.com", "lovable.app", "lovable.dev", "localhost"];
const domainSchema = z
  .string()
  .min(3)
  .max(253)
  .toLowerCase()
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/);

async function resolvePortalOrgFromHost(): Promise<{ id: string; join_policy: string } | null> {
  const host = getEffectiveHost();
  if (!host) return null;

  if (RESERVED_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))) return null;
  const parsed = domainSchema.safeParse(host);
  if (!parsed.success) return null;
  const safeHost = parsed.data;
  const bare = safeHost.replace(/^www\./, "");
  const { data: row } = await supabaseAdmin
    .from("website_custom_domains")
    .select("organization_id, mode")
    .or(`domain.eq.${safeHost},domain.eq.${bare},domain.eq.www.${bare}`)
    .not("verified_at", "is", null)
    .maybeSingle();
  if (!row || row.mode !== "portal") return null;
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id, join_policy")
    .eq("id", row.organization_id)
    .single();
  if (!org) return null;
  return { id: org.id, join_policy: (org as { join_policy?: string }).join_policy ?? "invite_only" };
}

// Requests membership under approval-mode. Org is resolved server-side from
// the portal-mode Host header — never trusted from the client. Insert path is
// guarded by RLS (user_id = auth.uid() AND status = 'pending').
export const requestJoin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const org = await resolvePortalOrgFromHost();
    if (!org) throw new Error("This site is not accepting join requests");
    if (org.join_policy !== "approval") {
      throw new Error("This organization is invite-only");
    }
    const organizationId = org.id;

    // If already an active member, no-op.
    const { data: existingMember } = await context.supabase
      .from("organization_members")
      .select("id, status")
      .eq("organization_id", organizationId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existingMember && (existingMember as { status?: string }).status === "active") {
      return { ok: true, already: "member" as const };
    }

    // Upsert pending request (unique index blocks duplicates while pending).
    const { data: existing } = await context.supabase
      .from("org_join_requests")
      .select("id, status")
      .eq("organization_id", organizationId)
      .eq("user_id", context.userId)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) return { ok: true, already: "requested" as const };

    const { error } = await context.supabase.from("org_join_requests").insert({
      organization_id: organizationId,
      user_id: context.userId,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true, already: null };
  });


export const listOrgJoinRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("org_join_requests")
      .select("id, user_id, status, created_at, decided_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return { requests: [] };

    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .in("user_id", userIds);
    const byUser = new Map(
      (profiles ?? []).map((p) => [p.user_id, p as { full_name: string | null; avatar_url: string | null }]),
    );
    return {
      requests: rows.map((r) => ({
        ...r,
        profile: byUser.get(r.user_id) ?? null,
      })),
    };
  });

export const approveJoinRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ requestId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("approve_join_request", { _request_id: data.requestId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const denyJoinRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ requestId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("deny_join_request", { _request_id: data.requestId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
