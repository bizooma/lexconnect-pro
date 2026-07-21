import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type OrgMembership = {
  organization_id: string;
  org_role: "owner" | "admin" | "content_editor" | "member";
  status: "active" | "invited" | "removed";
  organizations: {
    id: string;
    name: string;
    slug: string;
    kind: "firm" | "bar_association";
    logo_url: string | null;
  } | null;
};

export type OrgSubscription = {
  status: "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "grandfathered";
  plan: "starter" | "pro" | "firm";
  seats_purchased: number;
  current_period_end: string | null;
  trial_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

type Ctx = {
  loading: boolean;
  memberships: OrgMembership[];
  currentOrgId: string | null;
  currentOrg: OrgMembership["organizations"] | null;
  role: OrgMembership["org_role"] | null;
  subscription: OrgSubscription | null;
  canWrite: boolean;
  isOrgAdmin: boolean;
  canEditWebsite: boolean;
  switchOrg: (orgId: string) => void;
  refresh: () => Promise<void>;
};

const OrgContext = createContext<Ctx | null>(null);
const LS_KEY = "lexguild.currentOrgId";

export function CurrentOrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<OrgSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setMemberships([]);
      setCurrentOrgId(null);
      setSubscription(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("organization_members")
      .select("organization_id, org_role, status, organizations(id,name,slug,kind,logo_url)")
      .eq("user_id", user.id)
      .eq("status", "active");
    const list = (data as OrgMembership[] | null) ?? [];

    const stored = typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null;

    // Platform admins can view any org context — synthesize a membership
    // for an org they aren't a member of, so the org screens render.
    if (stored && !list.some((m) => m.organization_id === stored)) {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (roleRow) {
        const { data: orgRow } = await supabase
          .from("organizations")
          .select("id,name,slug,kind,logo_url")
          .eq("id", stored)
          .maybeSingle();
        if (orgRow) {
          list.push({
            organization_id: orgRow.id,
            org_role: "admin",
            status: "active",
            organizations: orgRow as OrgMembership["organizations"],
          });
        }
      }
    }

    setMemberships(list);
    const initial =
      list.find((m) => m.organization_id === stored)?.organization_id ??
      list[0]?.organization_id ??
      null;
    setCurrentOrgId(initial);
    setLoading(false);
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Load subscription when org changes
  useEffect(() => {
    if (!currentOrgId) { setSubscription(null); return; }
    supabase
      .from("subscriptions")
      .select("status, plan, seats_purchased, current_period_end, trial_end, stripe_customer_id, stripe_subscription_id")
      .eq("organization_id", currentOrgId)
      .maybeSingle()
      .then(({ data }) => setSubscription((data as OrgSubscription | null) ?? null));
  }, [currentOrgId]);

  const switchOrg = useCallback((orgId: string) => {
    if (typeof window !== "undefined") window.localStorage.setItem(LS_KEY, orgId);
    setCurrentOrgId(orgId);
    void refresh();
  }, [refresh]);

  const value = useMemo<Ctx>(() => {
    const membership = memberships.find((m) => m.organization_id === currentOrgId) ?? null;
    const status = subscription?.status ?? null;
    return {
      loading,
      memberships,
      currentOrgId,
      currentOrg: membership?.organizations ?? null,
      role: membership?.org_role ?? null,
      subscription,
      canWrite: status === "active" || status === "trialing" || status === "grandfathered",
      isOrgAdmin: membership?.org_role === "owner" || membership?.org_role === "admin",
      canEditWebsite:
        membership?.org_role === "owner" ||
        membership?.org_role === "admin" ||
        membership?.org_role === "content_editor",
      switchOrg,
      refresh,
    };
  }, [loading, memberships, currentOrgId, subscription, switchOrg, refresh]);

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useCurrentOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useCurrentOrg must be used within CurrentOrgProvider");
  return ctx;
}
