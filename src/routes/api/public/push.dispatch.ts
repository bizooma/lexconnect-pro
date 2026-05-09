import { createFileRoute } from "@tanstack/react-router";
import { sendNotification, type PushSubscription } from "web-push-neo";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { VAPID_PUBLIC_KEY, VAPID_SUBJECT } from "@/lib/push-config";

type Body = { notification_id: string };

const PREF_BY_KIND: Record<string, "push_messages" | "push_mentorship" | "push_meetings"> = {
  message: "push_messages",
  mentorship_request: "push_mentorship",
  mentorship_accepted: "push_mentorship",
  meeting: "push_meetings",
};

export const Route = createFileRoute("/api/public/push/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sharedSecret = process.env.PUSH_DISPATCH_SECRET;
        const provided = request.headers.get("x-push-secret");
        if (!sharedSecret || !provided || provided !== sharedSecret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
        if (!vapidPrivate) {
          return new Response("VAPID not configured", { status: 500 });
        }

        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (!body.notification_id) {
          return new Response("Missing notification_id", { status: 400 });
        }

        // Load notification
        const { data: notif, error: notifErr } = await supabaseAdmin
          .from("notifications")
          .select("id, user_id, kind, title, body, link")
          .eq("id", body.notification_id)
          .maybeSingle();
        if (notifErr || !notif) {
          return new Response("Notification not found", { status: 404 });
        }

        // Check user preferences
        const prefKey = PREF_BY_KIND[notif.kind];
        if (prefKey) {
          const { data: prefs } = await supabaseAdmin
            .from("notification_preferences")
            .select(prefKey)
            .eq("user_id", notif.user_id)
            .maybeSingle();
          // Defaults to true if no row
          if (prefs && (prefs as Record<string, boolean>)[prefKey] === false) {
            return Response.json({ skipped: "user_preference" });
          }
        }

        // Subscriptions for this user
        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth")
          .eq("user_id", notif.user_id);

        if (!subs || subs.length === 0) {
          return Response.json({ skipped: "no_subscriptions" });
        }

        const origin = new URL(request.url).origin;
        const linkAbs = notif.link
          ? notif.link.startsWith("http")
            ? notif.link
            : origin + notif.link
          : origin + "/app/dashboard";

        const payload = JSON.stringify({
          title: notif.title || "LexGuild",
          body: notif.body || "",
          url: linkAbs,
          tag: notif.kind + ":" + notif.id,
        });

        const vapidDetails = {
          subject: VAPID_SUBJECT,
          publicKey: VAPID_PUBLIC_KEY,
          privateKey: vapidPrivate,
        };

        const results = await Promise.allSettled(
          subs.map(async (s) => {
            const subscription: PushSubscription = {
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth },
            };
            try {
              const res = await sendNotification(subscription, payload, {
                vapidDetails,
                TTL: 60 * 60 * 24,
              });
              if (res.statusCode === 404 || res.statusCode === 410) {
                await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
                return { id: s.id, ok: false, status: res.statusCode };
              }
              return { id: s.id, ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode };
            } catch (err: unknown) {
              const status =
                err && typeof err === "object" && "statusCode" in err
                  ? (err as { statusCode?: number }).statusCode
                  : undefined;
              if (status === 404 || status === 410) {
                await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
              }
              return { id: s.id, ok: false, status, error: String(err) };
            }
          }),
        );

        const sent = results.filter((r) => r.status === "fulfilled" && (r.value as { ok: boolean }).ok).length;
        return Response.json({ sent, total: subs.length });
      },
    },
  },
});
