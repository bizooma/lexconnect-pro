import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type Profile = {
  id: string;
  user_id: string;
  organization_id: string | null;
  full_name: string | null;
  headline: string | null;
  firm: string | null;
  city: string | null;
  state: string | null;
  practice_areas: string[] | null;
  years_experience: number | null;
  bio: string | null;
  avatar_url: string | null;
  is_mentor: boolean;
  is_mentee: boolean;
  accepting_mentees: boolean;
};

const SELECT =
  "id,user_id,organization_id,full_name,headline,firm,city,state,practice_areas,years_experience,bio,avatar_url,is_mentor,is_mentee,accepting_mentees";

export function initialsOf(name?: string | null, fallback?: string | null) {
  const src = (name || fallback || "?").trim();
  return src
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export function locationOf(p: Pick<Profile, "city" | "state">) {
  return [p.city, p.state].filter(Boolean).join(", ");
}

/** Current signed-in user's profile. */
export function useMyProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("profiles")
      .select(SELECT)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile((data as Profile | null) ?? null);
        setLoading(false);
      });
  }, [user]);

  return { profile, loading };
}

/** All profiles in the directory (excludes current user). */
export function useDirectory() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const { data: me } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const orgId = (me as { organization_id: string | null } | null)?.organization_id;
      if (!orgId) {
        setProfiles([]);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select(SELECT)
        .eq("organization_id", orgId)
        .neq("user_id", user.id)
        .order("created_at", { ascending: false });
      setProfiles((data as Profile[] | null) ?? []);
      setLoading(false);
    })();
  }, [user]);

  return { profiles, loading };
}
