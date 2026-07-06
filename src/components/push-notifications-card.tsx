import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getCurrentSubscription,
  isInIframe,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";

type Status =
  | "loading"
  | "unsupported"
  | "iframe"
  | "denied"
  | "enabled"
  | "disabled";

export function PushNotificationsCard({ userId }: { userId: string | undefined }) {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isPushSupported()) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (isInIframe()) {
        if (!cancelled) setStatus("iframe");
        return;
      }
      if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }
      try {
        const sub = await getCurrentSubscription();
        if (!cancelled) setStatus(sub ? "enabled" : "disabled");
      } catch {
        if (!cancelled) setStatus("disabled");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      await subscribeToPush(userId);
      setStatus("enabled");
      toast.success("Push notifications enabled");
    } catch (err: any) {
      const msg = err?.message ?? "Could not enable push notifications";
      toast.error(msg);
      if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        setStatus("denied");
      }
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await unsubscribeFromPush();
      setStatus("disabled");
      toast.success("Push notifications disabled");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not disable push notifications");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-card lg:p-6">
      <h2 className="font-serif text-lg font-semibold text-foreground">Push notifications</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Get real-time alerts on this device for messages, mentorship requests, and Q&amp;A replies.
      </p>

      <div className="mt-4">
        {status === "loading" && (
          <p className="text-xs text-muted-foreground">Checking status…</p>
        )}

        {status === "unsupported" && (
          <p className="text-sm text-muted-foreground">
            This browser doesn't support push notifications. Try Chrome, Edge, Firefox, or Safari 16+.
          </p>
        )}

        {status === "iframe" && (
          <p className="text-sm text-muted-foreground">
            Push notifications can't be enabled from the in-app preview. Open the site in a full browser tab to enable them.
          </p>
        )}

        {status === "denied" && (
          <p className="text-sm text-muted-foreground">
            Notifications are blocked for this site. Enable them in your browser's site settings, then reload this page.
          </p>
        )}

        {status === "disabled" && (
          <button
            onClick={enable}
            disabled={busy || !userId}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-elegant transition hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "Enabling…" : "Enable push notifications"}
          </button>
        )}

        {status === "enabled" && (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Enabled on this device
            </span>
            <button
              onClick={disable}
              disabled={busy}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent disabled:opacity-50"
            >
              {busy ? "Disabling…" : "Disable"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
