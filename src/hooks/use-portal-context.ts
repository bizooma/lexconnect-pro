import { useEffect, useState } from "react";
import { getPortalContext } from "@/lib/website-domains.functions";

export type PortalContext = {
  organizationId: string;
  orgSlug: string;
  name: string;
  portal_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  accent_color: string | null;
  welcome_message: string | null;
  join_policy: "invite_only" | "approval";
  plan: "starter" | "pro" | "firm";
  show_powered_by: boolean;
};

export function usePortalContext() {
  const [portal, setPortal] = useState<PortalContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getPortalContext();
        if (!cancelled) setPortal((res.portal ?? null) as PortalContext | null);
      } catch {
        if (!cancelled) setPortal(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { portal, loading };
}
