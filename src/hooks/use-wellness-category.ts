import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";

export const WELLNESS_CATEGORY_SLUG = "well-being";

/** Resolves the current org's "Well-Being" Q&A category (slug `well-being`). */
export function useWellnessCategory() {
  const { currentOrgId } = useCurrentOrg();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrgId) {
      setCategoryId(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("qa_categories")
        .select("id, slug, name")
        .eq("organization_id", currentOrgId)
        .or(`slug.eq.${WELLNESS_CATEGORY_SLUG},name.eq.Well-Being`)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setCategoryId((data as { id: string } | null)?.id ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrgId]);

  return { categoryId, loading };
}
