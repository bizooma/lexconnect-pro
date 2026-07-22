import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const httpsUrl = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((v) => v.startsWith("https://"), "Must be an https:// URL");

const brandingSchema = z.object({
  organizationId: z.string().uuid(),
  portal_name: z.string().trim().max(80).nullable(),
  welcome_message: z.string().trim().max(2000).nullable(),
  logo_url: httpsUrl.nullable(),
  favicon_url: httpsUrl.nullable(),
  accent_color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB color")
    .nullable(),
});

async function assertOrgAdmin(
  supabase: SupabaseClient<Database>,
  userId: string,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("org_role, status")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { org_role?: string; status?: string } | null;
  if (!row || row.status !== "active" || (row.org_role !== "owner" && row.org_role !== "admin")) {
    throw new Error("Only organization admins can update portal settings");
  }
}

export const updatePortalBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => brandingSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(
      context.supabase as unknown as SupabaseClient<Database>,
      context.userId,
      data.organizationId,
    );
    const { error } = await context.supabase
      .from("organizations")
      .update({
        portal_name: data.portal_name,
        welcome_message: data.welcome_message,
        logo_url: data.logo_url,
        favicon_url: data.favicon_url,
        accent_color: data.accent_color,
      })
      .eq("id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateJoinPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        join_policy: z.enum(["invite_only", "approval"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(
      context.supabase as unknown as SupabaseClient<Database>,
      context.userId,
      data.organizationId,
    );
    const { error } = await context.supabase
      .from("organizations")
      .update({ join_policy: data.join_policy })
      .eq("id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
