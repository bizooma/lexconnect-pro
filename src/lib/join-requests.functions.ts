import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Requests membership under approval-mode. Insert path is guarded by RLS
// (user_id = auth.uid() AND status = 'pending'). No admin client used.
export const requestJoin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Only allow if org actually uses approval policy — defense in depth.
    const { data: org, error: orgErr } = await context.supabase
      .from("organizations")
      .select("id, join_policy")
      .eq("id", data.organizationId)
      .maybeSingle();
    if (orgErr || !org) throw new Error("Organization not found");
    if ((org as { join_policy?: string }).join_policy !== "approval") {
      throw new Error("This organization is invite-only");
    }

    // If already an active member, no-op.
    const { data: existingMember } = await context.supabase
      .from("organization_members")
      .select("id, status")
      .eq("organization_id", data.organizationId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existingMember && (existingMember as { status?: string }).status === "active") {
      return { ok: true, already: "member" as const };
    }

    // Upsert pending request (unique index blocks duplicates while pending).
    const { data: existing } = await context.supabase
      .from("org_join_requests")
      .select("id, status")
      .eq("organization_id", data.organizationId)
      .eq("user_id", context.userId)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) return { ok: true, already: "requested" as const };

    const { error } = await context.supabase.from("org_join_requests").insert({
      organization_id: data.organizationId,
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
