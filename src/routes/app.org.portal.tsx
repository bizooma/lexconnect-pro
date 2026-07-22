import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/hooks/use-current-org";
import {
  listCustomDomains,
  addCustomDomain,
  verifyCustomDomain,
} from "@/lib/website-domains.functions";
import { listOrgJoinRequests } from "@/lib/join-requests.functions";
import { updatePortalBranding, updateJoinPolicy } from "@/lib/org-portal.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/app/org/portal")({
  head: () => ({
    meta: [
      { title: "Client Portal — LexGuild" },
      { name: "description", content: "Manage your branded member portal: domain, branding, and access." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PortalPage,
});

type DomainRow = {
  id: string;
  domain: string;
  verification_token: string;
  verified_at: string | null;
  is_primary: boolean;
  default_page_slug: string | null;
  mode: "site" | "portal";
};

function PortalPage() {
  const { currentOrgId, currentOrg, isOrgAdmin, subscription, refresh } = useCurrentOrg();
  const trialActive =
    subscription?.status === "trialing" &&
    (!subscription.trial_end || new Date(subscription.trial_end) > new Date());
  const hasWhiteLabel =
    subscription?.plan === "firm" &&
    (subscription.status === "active" ||
      subscription.status === "grandfathered" ||
      trialActive);

  const list = useServerFn(listCustomDomains);
  const add = useServerFn(addCustomDomain);
  const verify = useServerFn(verifyCustomDomain);
  const saveBranding = useServerFn(updatePortalBranding);
  const savePolicy = useServerFn(updateJoinPolicy);
  const listRequests = useServerFn(listOrgJoinRequests);

  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  // Branding form state
  const [portalName, setPortalName] = useState("");
  const [welcome, setWelcome] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [accent, setAccent] = useState("#1f3a5f");
  const [joinPolicy, setJoinPolicy] = useState<"invite_only" | "approval">("invite_only");
  const [savingBrand, setSavingBrand] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);

  const refreshDomains = () => {
    if (!currentOrgId) return;
    setLoadingDomains(true);
    list({ data: { organizationId: currentOrgId } })
      .then((r) => setDomains((r.domains as DomainRow[]).filter((d) => d.mode === "portal")))
      .finally(() => setLoadingDomains(false));
  };

  useEffect(() => {
    if (!currentOrgId) return;
    refreshDomains();
    listRequests({ data: { organizationId: currentOrgId } })
      .then((r) => setPendingCount(r.requests.filter((x) => x.status === "pending").length))
      .catch(() => setPendingCount(0));
    supabase
      .from("organizations")
      .select("portal_name, welcome_message, logo_url, favicon_url, accent_color, join_policy")
      .eq("id", currentOrgId)
      .maybeSingle()
      .then(({ data }) => {
        const r = data as {
          portal_name: string | null;
          welcome_message: string | null;
          logo_url: string | null;
          favicon_url: string | null;
          accent_color: string | null;
          join_policy: string | null;
        } | null;
        if (!r) return;
        setPortalName(r.portal_name ?? "");
        setWelcome(r.welcome_message ?? "");
        setLogoUrl(r.logo_url ?? "");
        setFaviconUrl(r.favicon_url ?? "");
        setAccent(r.accent_color ?? "#1f3a5f");
        setJoinPolicy(r.join_policy === "approval" ? "approval" : "invite_only");
      });
  }, [currentOrgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayName = useMemo(
    () => portalName || currentOrg?.name || "Your portal",
    [portalName, currentOrg?.name],
  );

  if (!currentOrgId) {
    return <p className="p-8 text-sm text-muted-foreground">Select an organization to begin.</p>;
  }
  if (!isOrgAdmin) {
    return (
      <p className="p-8 text-sm text-muted-foreground">
        Only organization admins can manage the client portal.
      </p>
    );
  }

  const onAdd = async () => {
    const value = newDomain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
    if (!value) return;
    if (!hasWhiteLabel) {
      toast.error("Portal domains require the Firm plan.");
      return;
    }
    setBusy("add");
    try {
      await add({ data: { organizationId: currentOrgId, domain: value, mode: "portal" } });
      setNewDomain("");
      toast.success("Portal domain added — verify ownership next.");
      refreshDomains();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to add domain");
    } finally {
      setBusy(null);
    }
  };

  const onVerify = async (id: string) => {
    setBusy(id);
    try {
      await verify({ data: { id } });
      toast.success("Domain verified.");
      refreshDomains();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(null);
    }
  };

  const validateHttps = (label: string, url: string) => {
    if (!url) return true;
    try {
      const u = new URL(url);
      if (u.protocol !== "https:") {
        toast.error(`${label} must start with https://`);
        return false;
      }
      return true;
    } catch {
      toast.error(`${label} is not a valid URL`);
      return false;
    }
  };

  const onSaveBranding = async () => {
    if (!validateHttps("Logo URL", logoUrl)) return;
    if (!validateHttps("Favicon URL", faviconUrl)) return;
    if (!/^#[0-9a-fA-F]{6}$/.test(accent)) {
      toast.error("Accent color must be #RRGGBB");
      return;
    }
    setSavingBrand(true);
    try {
      await saveBranding({
        data: {
          organizationId: currentOrgId,
          portal_name: portalName.trim() || null,
          welcome_message: welcome.trim() || null,
          logo_url: logoUrl.trim() || null,
          favicon_url: faviconUrl.trim() || null,
          accent_color: accent,
        },
      });
      toast.success("Branding saved");
      void refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingBrand(false);
    }
  };

  const onSavePolicy = async (v: "invite_only" | "approval") => {
    setJoinPolicy(v);
    setSavingPolicy(true);
    try {
      await savePolicy({ data: { organizationId: currentOrgId, join_policy: v } });
      toast.success("Access policy updated");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSavingPolicy(false);
    }
  };

  const primaryPortalDomain = domains.find((d) => d.verified_at) ?? domains[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-5 py-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Organization
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-foreground">Client Portal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Serve the member app on your own domain with your branding.
        </p>
      </header>

      {/* STATUS */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-foreground">Status</h2>
          {primaryPortalDomain?.verified_at && (
            <a
              href={`https://${primaryPortalDomain.domain}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-primary hover:underline"
            >
              Visit portal ↗
            </a>
          )}
        </div>

        {!hasWhiteLabel && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
            <p className="font-medium">The Client Portal is a Firm-plan add-on.</p>
            <p className="mt-1">
              Upgrade to serve the member app on your own domain with your branding.{" "}
              <Link to="/app/org/billing" className="underline underline-offset-2">
                Upgrade plan
              </Link>
            </p>
          </div>
        )}

        {loadingDomains ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : domains.length === 0 ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              No portal domain yet. Add your domain and follow the DNS steps below.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="portal.yourfirm.com"
                className="min-w-[240px] flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              <Button onClick={onAdd} disabled={busy === "add" || !newDomain.trim() || !hasWhiteLabel}>
                {busy === "add" ? "Adding…" : "Add portal domain"}
              </Button>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">DNS setup (once your domain is added):</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>
                  Add a <strong>TXT</strong> record at <code>_lovable-verify.&lt;your-domain&gt;</code> with the
                  verification token we show you, then click Verify.
                </li>
                <li>
                  Add a <strong>CNAME</strong> for your portal subdomain pointing to
                  <code className="mx-1">cname.lovable.app</code> (or an A record to your hosting IP if using
                  the apex).
                </li>
              </ol>
            </div>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {domains.map((d) => (
              <li key={d.id} className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{d.domain}</p>
                      {d.verified_at ? (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                          Verified
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
                          Pending verification
                        </span>
                      )}
                    </div>
                    {d.verified_at ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Your portal domain will be activated within 1 business day.
                      </p>
                    ) : (
                      <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-xs">
                        <p className="font-medium text-foreground">Add this DNS record at your registrar:</p>
                        <dl className="mt-2 grid grid-cols-[80px_1fr] gap-y-1 font-mono">
                          <dt className="text-muted-foreground">Type</dt>
                          <dd>TXT</dd>
                          <dt className="text-muted-foreground">Name</dt>
                          <dd>_lovable-verify.{d.domain}</dd>
                          <dt className="text-muted-foreground">Value</dt>
                          <dd className="break-all">{d.verification_token}</dd>
                        </dl>
                        <p className="mt-2 text-muted-foreground">
                          Also add a <strong>CNAME</strong> pointing <code>{d.domain}</code> to your hosting
                          target (or an A record for an apex).
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {!d.verified_at && (
                      <Button size="sm" onClick={() => onVerify(d.id)} disabled={busy === d.id}>
                        {busy === d.id ? "Checking…" : "Verify"}
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* BRANDING */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <h2 className="font-serif text-lg font-semibold text-foreground">Branding</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          How your portal looks to members. Applied on your portal domain.
        </p>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Portal name
              </span>
              <Input
                className="mt-1.5"
                value={portalName}
                onChange={(e) => setPortalName(e.target.value)}
                placeholder={currentOrg?.name ?? "Your portal"}
                maxLength={80}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Welcome message
              </span>
              <textarea
                value={welcome}
                onChange={(e) => setWelcome(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Sign in to your legal community."
                className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm shadow-card outline-none ring-ring/30 focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Logo URL (https)
              </span>
              <Input
                className="mt-1.5"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://…/logo.png"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Favicon URL (https)
              </span>
              <Input
                className="mt-1.5"
                value={faviconUrl}
                onChange={(e) => setFaviconUrl(e.target.value)}
                placeholder="https://…/favicon.ico"
              />
            </label>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Accent color
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="h-10 w-16 cursor-pointer rounded border border-border bg-card"
                />
                <Input
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
            <Button onClick={onSaveBranding} disabled={savingBrand}>
              {savingBrand ? "Saving…" : "Save branding"}
            </Button>
          </div>

          {/* Live preview */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Login preview
            </p>
            <div
              className="rounded-2xl border border-border bg-background p-6 shadow-card"
              style={{ borderTop: `3px solid ${accent}` }}
            >
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt=""
                    className="h-10 w-10 rounded object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                    }}
                  />
                ) : (
                  <div
                    className="h-10 w-10 rounded"
                    style={{ background: accent }}
                    aria-hidden
                  />
                )}
                <div className="font-serif text-lg font-semibold text-foreground">
                  {displayName}
                </div>
              </div>
              <h3 className="mt-5 font-serif text-xl font-semibold text-foreground">
                Sign in to {displayName}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {welcome || "Sign in to your legal community."}
              </p>
              <div className="mt-4 space-y-2">
                <div className="h-9 rounded-md border border-input bg-background" />
                <div className="h-9 rounded-md border border-input bg-background" />
                <div
                  className="flex h-9 items-center justify-center rounded-md text-sm font-medium text-white"
                  style={{ background: accent }}
                >
                  Sign in
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ACCESS */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <h2 className="font-serif text-lg font-semibold text-foreground">Access</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Control who can join your portal.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Join policy
            </p>
            <Select
              value={joinPolicy}
              onValueChange={(v) => void onSavePolicy(v as "invite_only" | "approval")}
              disabled={savingPolicy}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="invite_only">
                  Invite only — members join with an invite token
                </SelectItem>
                <SelectItem value="approval">
                  Approval — users can request access and admins approve
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Also shown in{" "}
              <Link to="/app/org/settings" className="underline">
                Org settings
              </Link>
              .
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Join requests</p>
              <p className="text-xs text-muted-foreground">
                Review users waiting for access to your portal.
              </p>
            </div>
            <Link
              to="/app/org/join-requests"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:border-primary/40"
            >
              Open queue
              {pendingCount > 0 && (
                <span className="rounded-full bg-destructive px-2 py-0.5 text-[11px] font-semibold text-destructive-foreground">
                  {pendingCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
