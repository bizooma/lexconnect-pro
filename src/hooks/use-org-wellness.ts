import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";

export type OrgWellness = {
  wellness_enabled: boolean;
  lap_name: string | null;
  lap_phone: string | null;
  lap_url: string | null;
};

export function useOrgWellness() {
  const { currentOrgId } = useCurrentOrg();
  const [wellness, setWellness] = useState<OrgWellness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrgId) {
      setWellness(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("organizations")
      .select("wellness_enabled, lap_name, lap_phone, lap_url")
      .eq("id", currentOrgId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setWellness((data as OrgWellness | null) ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentOrgId]);

  return { wellness, enabled: !!wellness?.wellness_enabled, loading };
}
