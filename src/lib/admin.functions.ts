import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function requirePlatformAdmin(accessToken: string): Promise<string> {
  if (!accessToken) throw new Error("Not authenticated");
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
  if (userErr || !userData?.user) throw new Error("Invalid session");
  const userId = userData.user.id;
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) throw new Error("Forbidden");
  return userId;
}

export const listAuthUsersSafe = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data }) => {
    const out: { id: string; email: string | null; created_at: string; banned: boolean }[] = [];
    try {
      await requirePlatformAdmin(data.accessToken);
      let page = 1;
      while (true) {
        const { data: pageData, error } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 1000,
        });
        if (error) {
          console.error("[listAuthUsers] listUsers error:", error);
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
      return { users: out, error: null as string | null };
    } catch (e: any) {
      console.error("[listAuthUsers] unexpected error:", e);
      return { users: out, error: e?.message ?? "Failed to load auth users" };
    }
  });

export const setPlatformAdminSafe = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string; userId: string; grant: boolean }) => data)
  .handler(async ({ data }) => {
    try {
      await requirePlatformAdmin(data.accessToken);
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
      return { ok: true, error: null as string | null };
    } catch (e: any) {
      console.error("[setPlatformAdmin] error:", e);
      return { ok: false, error: e?.message ?? "Failed" };
    }
  });

export const deleteAuthUserSafe = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string; userId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const callerId = await requirePlatformAdmin(data.accessToken);
      if (callerId === data.userId) throw new Error("You cannot delete your own account");
      const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
      if (error) throw new Error(error.message);
      return { ok: true, error: null as string | null };
    } catch (e: any) {
      console.error("[deleteAuthUser] error:", e);
      return { ok: false, error: e?.message ?? "Failed" };
    }
  });

export const setUserBannedSafe = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string; userId: string; banned: boolean }) => data)
  .handler(async ({ data }) => {
    try {
      const callerId = await requirePlatformAdmin(data.accessToken);
      if (callerId === data.userId) throw new Error("You cannot pause your own account");
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        ban_duration: data.banned ? "876000h" : "none",
      } as unknown as Record<string, unknown>);
      if (error) throw new Error(error.message);
      return { ok: true, error: null as string | null };
    } catch (e: any) {
      console.error("[setUserBanned] error:", e);
      return { ok: false, error: e?.message ?? "Failed" };
    }
  });

export const setOrgAdminSafe = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { accessToken: string; userId: string; organizationId: string; makeAdmin: boolean }) =>
      data,
  )
  .handler(async ({ data }) => {
    try {
      await requirePlatformAdmin(data.accessToken);
      const { error } = await supabaseAdmin
        .from("organization_members")
        .update({ org_role: data.makeAdmin ? "admin" : "member" })
        .eq("organization_id", data.organizationId)
        .eq("user_id", data.userId);
      if (error) throw new Error(error.message);
      return { ok: true, error: null as string | null };
    } catch (e: any) {
      console.error("[setOrgAdmin] error:", e);
      return { ok: false, error: e?.message ?? "Failed" };
    }
  });
