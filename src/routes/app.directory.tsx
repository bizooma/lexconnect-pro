import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Search, Settings, MapPin, Briefcase, Building2 } from "lucide-react";

export const Route = createFileRoute("/app/directory")({
  component: DirectoryPage,
});

type MemberDirectoryEntry = {
  user_id: string;
  full_name: string;
  firm: string | null;
  city: string | null;
  state: string | null;
  practice_areas: string[] | null;
  bar_admissions: string[] | null;
  years_experience: number | null;
  avatar_url: string | null;
  headline: string | null;
  accepting_referrals: boolean;
};

type MemberPrefs = {
  directory_opt_out: boolean;
  accepting_referrals: boolean;
  headline: string;
};

const DEFAULT_PREFS: MemberPrefs = {
  directory_opt_out: false,
  accepting_referrals: true,
  headline: "",
};

function DirectoryPage() {
  const { user } = useAuth();
  const { currentOrgId } = useCurrentOrg();

  const [members, setMembers] = useState<MemberDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [practiceFilter, setPracticeFilter] = useState<string>("all");

  const [selectedMember, setSelectedMember] = useState<MemberDirectoryEntry | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefs, setPrefs] = useState<MemberPrefs>(DEFAULT_PREFS);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const loadDirectory = async () => {
    if (!currentOrgId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("get_org_directory", {
        _org_id: currentOrgId,
      });
      if (rpcError) throw rpcError;
      const list = (data as unknown as MemberDirectoryEntry[] | null) ?? [];
      setMembers(list);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load directory";
      setError(msg);
      toast.error("Could not load directory", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  const loadPrefs = async () => {
    if (!currentOrgId || !user) return;
    const { data } = await supabase
      .from("member_directory_prefs")
      .select("directory_opt_out, accepting_referrals, headline")
      .eq("organization_id", currentOrgId)
      .eq("user_id", user.id)
      .maybeSingle();
    setPrefs({
      directory_opt_out: data?.directory_opt_out ?? false,
      accepting_referrals: data?.accepting_referrals ?? true,
      headline: data?.headline ?? "",
    });
  };

  useEffect(() => {
    void loadDirectory();
  }, [currentOrgId]);

  useEffect(() => {
    void loadPrefs();
  }, [currentOrgId, user?.id]);

  const practiceAreas = useMemo(() => {
    const set = new Set<string>();
    for (const m of members) {
      for (const area of m.practice_areas ?? []) {
        if (area) set.add(area);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [members]);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return members.filter((m) => {
      const matchesSearch =
        !q ||
        (m.full_name ?? "").toLowerCase().includes(q) ||
        (m.firm ?? "").toLowerCase().includes(q) ||
        (m.headline ?? "").toLowerCase().includes(q) ||
        (m.practice_areas ?? []).some((a) => a.toLowerCase().includes(q));
      const matchesPractice =
        practiceFilter === "all" || (m.practice_areas ?? []).some((a) => a === practiceFilter);
      return matchesSearch && matchesPractice;
    });
  }, [members, searchQuery, practiceFilter]);

  const handleSavePrefs = async () => {
    if (!currentOrgId || !user) return;
    setSavingPrefs(true);
    const { error: upsertError } = await supabase.from("member_directory_prefs").upsert(
      {
        organization_id: currentOrgId,
        user_id: user.id,
        directory_opt_out: prefs.directory_opt_out,
        accepting_referrals: prefs.accepting_referrals,
        headline: prefs.headline.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,user_id" },
    );
    setSavingPrefs(false);
    if (upsertError) {
      toast.error("Could not save settings", { description: upsertError.message });
      return;
    }
    toast.success("Directory settings saved");
    setSettingsOpen(false);
    await loadDirectory();
    await loadPrefs();
  };

  const showEmpty = !loading && !error && filteredMembers.length === 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
            Member network
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-foreground">
            Member Directory
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse and connect with attorneys in your organization.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSettingsOpen(true)}
          className="self-start sm:self-auto"
        >
          <Settings className="mr-2 h-4 w-4" />
          Directory settings
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, firm, or practice area"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="sm:w-64">
          <label htmlFor="practice-filter" className="sr-only">
            Practice area
          </label>
          <select
            id="practice-filter"
            value={practiceFilter}
            onChange={(e) => setPracticeFilter(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All practice areas</option>
            {practiceAreas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="mt-8 rounded-2xl border border-destructive/20 bg-destructive/10 p-6 text-center">
          <p className="text-sm font-medium text-destructive">Could not load directory</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => loadDirectory()}>
            Try again
          </Button>
        </div>
      )}

      {!loading && !error && (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredMembers.map((member) => (
            <MemberCard
              key={member.user_id}
              member={member}
              isMe={member.user_id === user?.id}
              onClick={() => setSelectedMember(member)}
            />
          ))}
        </div>
      )}

      {showEmpty && (
        <div className="mt-12 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="font-serif text-lg font-medium text-foreground">No members found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try adjusting your search or filters, or check your directory settings.
          </p>
        </div>
      )}

      <MemberDetailDialog
        member={selectedMember}
        open={!!selectedMember}
        onOpenChange={(open) => {
          if (!open) setSelectedMember(null);
        }}
      />

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Directory settings</DialogTitle>
            <DialogDescription>Control how you appear in the member directory.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="list-me" className="text-sm font-medium">
                  List me in the member directory
                </Label>
                <p className="text-xs text-muted-foreground">
                  Other members can see your profile card.
                </p>
              </div>
              <Switch
                id="list-me"
                checked={!prefs.directory_opt_out}
                onCheckedChange={(checked) =>
                  setPrefs((p) => ({ ...p, directory_opt_out: !checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="accept-referrals" className="text-sm font-medium">
                  Open to receiving referrals
                </Label>
                <p className="text-xs text-muted-foreground">
                  Show an “Accepting referrals” badge on your profile.
                </p>
              </div>
              <Switch
                id="accept-referrals"
                checked={prefs.accepting_referrals}
                onCheckedChange={(checked) =>
                  setPrefs((p) => ({ ...p, accepting_referrals: checked }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="headline" className="text-sm font-medium">
                Headline
              </Label>
              <Input
                id="headline"
                placeholder="Short tagline (e.g., “Employment law, startups, founders”)"
                value={prefs.headline}
                onChange={(e) => setPrefs((p) => ({ ...p, headline: e.target.value }))}
                maxLength={120}
              />
              <p className="text-right text-xs text-muted-foreground">
                {prefs.headline.length}/120
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSettingsOpen(false)} disabled={savingPrefs}>
              Cancel
            </Button>
            <Button onClick={handleSavePrefs} disabled={savingPrefs}>
              {savingPrefs ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MemberCard({
  member,
  isMe,
  onClick,
}: {
  member: MemberDirectoryEntry;
  isMe: boolean;
  onClick: () => void;
}) {
  const initials = (member.full_name ?? "?")
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  const location = [member.city, member.state].filter(Boolean).join(", ");

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full gap-4 rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/30 hover:shadow-sm"
    >
      <Avatar initials={initials} src={member.avatar_url} size={56} tone="navy" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-serif text-base font-semibold text-foreground">
              {member.full_name}
              {isMe && (
                <span className="ml-2 align-middle text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  You
                </span>
              )}
            </p>
            {member.headline && (
              <p className="truncate text-xs text-muted-foreground">{member.headline}</p>
            )}
          </div>
          {member.accepting_referrals && (
            <Badge
              variant="outline"
              className="shrink-0 text-[10px] text-emerald-600 dark:text-emerald-400"
            >
              Accepting referrals
            </Badge>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {member.firm && (
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {member.firm}
            </span>
          )}
          {location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {location}
            </span>
          )}
          {member.years_experience !== null && member.years_experience !== undefined && (
            <span>
              {member.years_experience} year{member.years_experience === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {member.practice_areas && member.practice_areas.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {member.practice_areas.slice(0, 3).map((area) => (
              <Badge key={area} variant="secondary" className="text-[10px]">
                {area}
              </Badge>
            ))}
            {member.practice_areas.length > 3 && (
              <Badge variant="secondary" className="text-[10px]">
                +{member.practice_areas.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

function MemberDetailDialog({
  member,
  open,
  onOpenChange,
}: {
  member: MemberDirectoryEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!member) return null;
  const initials = (member.full_name ?? "?")
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  const location = [member.city, member.state].filter(Boolean).join(", ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="sr-only">{member.full_name}</DialogTitle>
          <DialogDescription className="sr-only">Member profile details</DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-4 py-2">
          <Avatar initials={initials} src={member.avatar_url} size={72} tone="navy" />
          <div className="min-w-0 flex-1">
            <p className="font-serif text-xl font-semibold text-foreground">{member.full_name}</p>
            {member.headline && (
              <p className="mt-0.5 text-sm text-muted-foreground">{member.headline}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {member.firm && (
                <span className="inline-flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  {member.firm}
                </span>
              )}
              {location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {location}
                </span>
              )}
              {member.years_experience !== null && member.years_experience !== undefined && (
                <span>
                  {member.years_experience} year{member.years_experience === 1 ? "" : "s"}{" "}
                  experience
                </span>
              )}
            </div>
          </div>
          {member.accepting_referrals && (
            <Badge variant="outline" className="shrink-0 text-emerald-600 dark:text-emerald-400">
              Accepting referrals
            </Badge>
          )}
        </div>

        {member.practice_areas && member.practice_areas.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Practice areas
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {member.practice_areas.map((area) => (
                <Badge key={area} variant="secondary">
                  {area}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {member.bar_admissions && member.bar_admissions.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Bar admissions
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {member.bar_admissions.map((bar) => (
                <Badge key={bar} variant="secondary">
                  {bar}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button disabled title="Coming next">
            Send referral
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
