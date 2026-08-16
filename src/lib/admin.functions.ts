import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DENIED = "PLATFORM_ADMIN_DENIED";

function isDenied(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === DENIED;
}

function deniedError(message: string): Error & { code: string } {
  const err = new Error(message) as Error & { code: string };
  err.code = DENIED;
  return err;
}

async function requirePlatformAdmin(
  accessToken: string,
): Promise<{ id: string; email: string | null }> {
  if (!accessToken) throw deniedError("Not authenticated");
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
  if (userErr || !userData?.user) throw deniedError("Invalid session");
  const userId = userData.user.id;
  const email = userData.user.email ?? null;
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) throw deniedError("Forbidden");
  return { id: userId, email };
}

type AuditEntry = {
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  targetUserId?: string | null;
  targetOrganizationId?: string | null;
  details?: Record<string, unknown>;
  result: "success" | "error" | "denied";
  errorMessage?: string | null;
};

async function logAdminAction(entry: AuditEntry): Promise<void> {
  try {
    await supabaseAdmin.from("platform_admin_audit_log").insert({
      actor_user_id: entry.actorUserId,
      actor_email: entry.actorEmail,
      action: entry.action,
      target_user_id: entry.targetUserId ?? null,
      target_organization_id: entry.targetOrganizationId ?? null,
      details: entry.details ?? {},
      result: entry.result,
      error_message: entry.errorMessage ?? null,
    });
  } catch (e) {
    // Never fail the operation because logging failed.
    console.error("[audit] failed to write audit entry", entry.action, e);
  }
}

export const listAuthUsersSafe = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data }) => {
    const out: { id: string; email: string | null; created_at: string; banned: boolean }[] = [];
    let actorUserId: string | null = null;
    let actorEmail: string | null = null;
    try {
      const actor = await requirePlatformAdmin(data.accessToken);
      actorUserId = actor.id;
      actorEmail = actor.email;
      let page = 1;
      while (true) {
        const { data: pageData, error } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 1000,
        });
        if (error) {
          console.error("[listAuthUsers] listUsers error:", error);
          await logAdminAction({
            actorUserId,
            actorEmail,
            action: "list_auth_users",
            details: { returned: out.length },
            result: "error",
            errorMessage: error.message,
          });
          return { users: out, error: error.message };
        }
        for (const u of pageData.users) {
          const bannedUntil = (u as unknown as { banned_until?: string | null }).banned_until;
          const banned = !!bannedUntil && new Date(bannedUntil).getTime() > Date.now();
          out.push({ id: u.id, email: u.email ?? null, created_at: u.created_at, banned });
        }
        if (pageData.users.length < 1000) break;
        page++;
        if (page > 20) break;
      }
      await logAdminAction({
        actorUserId,
        actorEmail,
        action: "list_auth_users",
        details: { returned: out.length },
        result: "success",
      });
      return { users: out, error: null as string | null };
    } catch (e: any) {
      console.error("[listAuthUsers] unexpected error:", e);
      await logAdminAction({
        actorUserId,
        actorEmail,
        action: "list_auth_users",
        details: { returned: out.length },
        result: isDenied(e) ? "denied" : "error",
        errorMessage: e?.message ?? "Failed to load auth users",
      });
      return { users: out, error: e?.message ?? "Failed to load auth users" };
    }
  });

export const setPlatformAdminSafe = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string; userId: string; grant: boolean }) => data)
  .handler(async ({ data }) => {
    const action = data.grant ? "grant_platform_admin" : "revoke_platform_admin";
    let actorUserId: string | null = null;
    let actorEmail: string | null = null;
    try {
      const actor = await requirePlatformAdmin(data.accessToken);
      actorUserId = actor.id;
      actorEmail = actor.email;
      if (data.grant) {
        const { error } = await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", data.userId)
          .eq("role", "admin");
        if (error) throw new Error(error.message);
      }
      await logAdminAction({
        actorUserId,
        actorEmail,
        action,
        targetUserId: data.userId,
        details: {},
        result: "success",
      });
      return { ok: true, error: null as string | null };
    } catch (e: any) {
      console.error("[setPlatformAdmin] error:", e);
      await logAdminAction({
        actorUserId,
        actorEmail,
        action,
        targetUserId: data.userId,
        details: {},
        result: isDenied(e) ? "denied" : "error",
        errorMessage: e?.message ?? "Failed",
      });
      return { ok: false, error: e?.message ?? "Failed" };
    }
  });

export const deleteAuthUserSafe = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string; userId: string }) => data)
  .handler(async ({ data }) => {
    let actorUserId: string | null = null;
    let actorEmail: string | null = null;
    try {
      const actor = await requirePlatformAdmin(data.accessToken);
      actorUserId = actor.id;
      actorEmail = actor.email;
      if (actor.id === data.userId) throw new Error("You cannot delete your own account");
      const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
      if (error) throw new Error(error.message);
      await logAdminAction({
        actorUserId,
        actorEmail,
        action: "delete_auth_user",
        targetUserId: data.userId,
        details: {},
        result: "success",
      });
      return { ok: true, error: null as string | null };
    } catch (e: any) {
      console.error("[deleteAuthUser] error:", e);
      await logAdminAction({
        actorUserId,
        actorEmail,
        action: "delete_auth_user",
        targetUserId: data.userId,
        details: {},
        result: isDenied(e) ? "denied" : "error",
        errorMessage: e?.message ?? "Failed",
      });
      return { ok: false, error: e?.message ?? "Failed" };
    }
  });

export const setUserBannedSafe = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string; userId: string; banned: boolean }) => data)
  .handler(async ({ data }) => {
    const action = data.banned ? "ban_user" : "unban_user";
    let actorUserId: string | null = null;
    let actorEmail: string | null = null;
    try {
      const actor = await requirePlatformAdmin(data.accessToken);
      actorUserId = actor.id;
      actorEmail = actor.email;
      if (actor.id === data.userId) throw new Error("You cannot pause your own account");
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        ban_duration: data.banned ? "876000h" : "none",
      } as unknown as Record<string, unknown>);
      if (error) throw new Error(error.message);
      await logAdminAction({
        actorUserId,
        actorEmail,
        action,
        targetUserId: data.userId,
        details: {},
        result: "success",
      });
      return { ok: true, error: null as string | null };
    } catch (e: any) {
      console.error("[setUserBanned] error:", e);
      await logAdminAction({
        actorUserId,
        actorEmail,
        action,
        targetUserId: data.userId,
        details: {},
        result: isDenied(e) ? "denied" : "error",
        errorMessage: e?.message ?? "Failed",
      });
      return { ok: false, error: e?.message ?? "Failed" };
    }
  });

export const setOrgPausedSafe = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string; organizationId: string; paused: boolean }) => data)
  .handler(async ({ data }) => {
    const action = data.paused ? "pause_org" : "unpause_org";
    let actorUserId: string | null = null;
    let actorEmail: string | null = null;
    try {
      const actor = await requirePlatformAdmin(data.accessToken);
      actorUserId = actor.id;
      actorEmail = actor.email;
      const { error } = await supabaseAdmin
        .from("organizations")
        .update({ paused: data.paused, paused_at: data.paused ? new Date().toISOString() : null })
        .eq("id", data.organizationId);
      if (error) throw new Error(error.message);
      await logAdminAction({
        actorUserId,
        actorEmail,
        action,
        targetOrganizationId: data.organizationId,
        details: {},
        result: "success",
      });
      return { ok: true, error: null as string | null };
    } catch (e: any) {
      console.error("[setOrgPaused] error:", e);
      await logAdminAction({
        actorUserId,
        actorEmail,
        action,
        targetOrganizationId: data.organizationId,
        details: {},
        result: isDenied(e) ? "denied" : "error",
        errorMessage: e?.message ?? "Failed",
      });
      return { ok: false, error: e?.message ?? "Failed" };
    }
  });

export const createUserAndAssignOrgSafe = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      accessToken: string;
      email: string;
      fullName?: string;
      password?: string;
      organizationId: string;
      orgRole: "member" | "admin" | "owner";
      sendInvite?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    let actorUserId: string | null = null;
    let actorEmail: string | null = null;
    let userId: string | null = null;
    const auditDetails: Record<string, unknown> = {
      email: data.email?.trim().toLowerCase() ?? null,
      orgRole: data.orgRole,
      sendInvite: !!data.sendInvite,
    };
    try {
      const actor = await requirePlatformAdmin(data.accessToken);
      actorUserId = actor.id;
      actorEmail = actor.email;
      const email = data.email.trim().toLowerCase();
      if (!email) throw new Error("Email is required");

      if (data.sendInvite) {
        const { data: inv, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
          email,
          { data: { full_name: data.fullName ?? "" } },
        );
        if (invErr) {
          // If user already exists, fetch by listing
          if (!/already/i.test(invErr.message)) throw new Error(invErr.message);
        } else {
          userId = inv.user?.id ?? null;
        }
      } else {
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: data.password || undefined,
          email_confirm: true,
          user_metadata: { full_name: data.fullName ?? "" },
        });
        if (createErr) {
          if (!/already/i.test(createErr.message)) throw new Error(createErr.message);
        } else {
          userId = created.user?.id ?? null;
        }
      }

      // Resolve user id if we hit "already exists"
      if (!userId) {
        let page = 1;
        outer: while (page <= 20) {
          const { data: pageData, error } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage: 1000,
          });
          if (error) throw new Error(error.message);
          for (const u of pageData.users) {
            if ((u.email ?? "").toLowerCase() === email) {
              userId = u.id;
              break outer;
            }
          }
          if (pageData.users.length < 1000) break;
          page++;
        }
      }
      if (!userId) throw new Error("Could not resolve user id after creation");

      // Ensure profile exists and is on the target org
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (existingProfile) {
        await supabaseAdmin
          .from("profiles")
          .update({
            organization_id: data.organizationId,
            ...(data.fullName ? { full_name: data.fullName } : {}),
          })
          .eq("user_id", userId);
      } else {
        await supabaseAdmin.from("profiles").insert({
          user_id: userId,
          full_name: data.fullName ?? email,
          organization_id: data.organizationId,
        });
      }

      // Upsert membership
      const { error: memErr } = await supabaseAdmin
        .from("organization_members")
        .upsert(
          {
            organization_id: data.organizationId,
            user_id: userId,
            org_role: data.orgRole,
            status: "active",
            joined_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,user_id" },
        );
      if (memErr) throw new Error(memErr.message);

      await logAdminAction({
        actorUserId,
        actorEmail,
        action: "create_user_and_assign_org",
        targetUserId: userId,
        targetOrganizationId: data.organizationId,
        details: auditDetails,
        result: "success",
      });
      return { ok: true, userId, error: null as string | null };
    } catch (e: any) {
      console.error("[createUserAndAssignOrg] error:", e);
      await logAdminAction({
        actorUserId,
        actorEmail,
        action: "create_user_and_assign_org",
        targetUserId: userId,
        targetOrganizationId: data.organizationId,
        details: auditDetails,
        result: isDenied(e) ? "denied" : "error",
        errorMessage: e?.message ?? "Failed",
      });
      return { ok: false, userId: null as string | null, error: e?.message ?? "Failed" };
    }
  });

export const setOrgAdminSafe = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { accessToken: string; userId: string; organizationId: string; makeAdmin: boolean }) =>
      data,
  )
  .handler(async ({ data }) => {
    const action = data.makeAdmin ? "grant_org_admin" : "revoke_org_admin";
    let actorUserId: string | null = null;
    let actorEmail: string | null = null;
    try {
      const actor = await requirePlatformAdmin(data.accessToken);
      actorUserId = actor.id;
      actorEmail = actor.email;
      const { error } = await supabaseAdmin
        .from("organization_members")
        .update({ org_role: data.makeAdmin ? "admin" : "member" })
        .eq("organization_id", data.organizationId)
        .eq("user_id", data.userId);
      if (error) throw new Error(error.message);
      await logAdminAction({
        actorUserId,
        actorEmail,
        action,
        targetUserId: data.userId,
        targetOrganizationId: data.organizationId,
        details: {},
        result: "success",
      });
      return { ok: true, error: null as string | null };
    } catch (e: any) {
      console.error("[setOrgAdmin] error:", e);
      await logAdminAction({
        actorUserId,
        actorEmail,
        action,
        targetUserId: data.userId,
        targetOrganizationId: data.organizationId,
        details: {},
        result: isDenied(e) ? "denied" : "error",
        errorMessage: e?.message ?? "Failed",
      });
      return { ok: false, error: e?.message ?? "Failed" };
    }
  });
