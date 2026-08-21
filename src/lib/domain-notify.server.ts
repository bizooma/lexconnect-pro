import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Notifies platform admins (users with the 'admin' app role) that a tenant
 * custom domain has been verified and needs to be connected manually in the
 * Lovable dashboard. Fires at most once per domain (guarded by
 * website_custom_domains.admin_notified_at).
 */
export async function notifyAdminsDomainReady(domainId: string): Promise<void> {
  const { data: row } = await supabaseAdmin
    .from("website_custom_domains")
    .select("id, domain, mode, organization_id, admin_notified_at, verified_at")
    .eq("id", domainId)
    .maybeSingle();
  if (!row || !row.verified_at || row.admin_notified_at) return;

  // Claim the notification slot first so concurrent verifies don't double-send.
  const { data: claimed } = await supabaseAdmin
    .from("website_custom_domains")
    .update({ admin_notified_at: new Date().toISOString() })
    .eq("id", domainId)
    .is("admin_notified_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  try {
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", row.organization_id)
      .maybeSingle();

    const { data: admins } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const recipients: string[] = [];
    for (const a of admins ?? []) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(a.user_id);
      const email = u?.user?.email;
      if (email) recipients.push(email.toLowerCase());
    }
    const unique = Array.from(new Set(recipients));
    if (unique.length === 0) return;

    const [{ render }, React, { DomainReadyEmail }] = await Promise.all([
      import("@react-email/components"),
      import("react"),
      import("@/lib/email-templates/domain-ready"),
    ]);

    const templateData = {
      orgName: org?.name ?? "Unknown organization",
      domain: row.domain,
      mode: row.mode ?? "site",
    };
    const element = React.createElement(DomainReadyEmail as never, templateData);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject = `Domain ready to connect: ${row.domain}`;
    const senderDomain = process.env['EMAIL_SENDER_DOMAIN'] || "notify.lexguild.com";

    for (const to of unique) {
      await supabaseAdmin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          message_id: globalThis.crypto?.randomUUID?.() ?? `${domainId}-${to}`,
          to,
          from: `LexGuild <noreply@lexguild.com>`,
          sender_domain: senderDomain,
          subject,
          html,
          text,
          purpose: "transactional",
          label: "domain-ready",
          queued_at: new Date().toISOString(),
        },
      });
    }
  } catch (e) {
    console.error("[domain-notify] failed to notify platform admins", e);
  }
}
