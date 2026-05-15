import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/hooks/use-current-org";
import {
  listCustomDomains,
  addCustomDomain,
  removeCustomDomain,
  verifyCustomDomain,
  updateCustomDomain,
} from "@/lib/website-domains.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/app/website/domains")({
  component: DomainsPage,
});

type DomainRow = {
  id: string;
  domain: string;
  verification_token: string;
  verified_at: string | null;
  is_primary: boolean;
  default_page_slug: string | null;
};

function DomainsPage() {
  const { currentOrgId } = useCurrentOrg();
  const list = useServerFn(listCustomDomains);
  const add = useServerFn(addCustomDomain);
  const remove = useServerFn(removeCustomDomain);
  const verify = useServerFn(verifyCustomDomain);
  const update = useServerFn(updateCustomDomain);

  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => {
    if (!currentOrgId) return;
    setLoading(true);
    list({ data: { organizationId: currentOrgId } })
      .then((r) => setDomains(r.domains as DomainRow[]))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, [currentOrgId]);

  if (!currentOrgId) {
    return <p className="text-sm text-muted-foreground">Select an organization to begin.</p>;
  }

  const onAdd = async () => {
    const value = newDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!value) return;
    setBusy("add");
    try {
      await add({ data: { organizationId: currentOrgId, domain: value } });
      setNewDomain("");
      toast.success("Domain added — verify ownership next.");
      refresh();
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
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(null);
    }
  };

  const onRemove = async (id: string) => {
    if (!confirm("Remove this domain?")) return;
    setBusy(id);
    try {
      await remove({ data: { id } });
      refresh();
    } finally {
      setBusy(null);
    }
  };

  const onMakePrimary = async (id: string) => {
    setBusy(id);
    try {
      await update({ data: { id, isPrimary: true } });
      refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Add a custom domain</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your own domain (e.g. <code className="rounded bg-muted px-1">www.yourfirm.com</code>) to your published website.
        </p>
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="www.yourfirm.com"
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={onAdd}
            disabled={busy === "add" || !newDomain.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy === "add" ? "Adding…" : "Add domain"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <header className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">Connected domains</h2>
        </header>
        {loading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Loading…</p>
        ) : domains.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No custom domains yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {domains.map((d) => (
              <li key={d.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
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
                      {d.is_primary && (
                        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                          Primary
                        </span>
                      )}
                    </div>
                    {!d.verified_at && (
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
                          After the TXT record propagates, also add a CNAME record pointing{" "}
                          <code className="rounded bg-background px-1">{d.domain}</code> to your published site host.
                          Then click Verify.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    {!d.verified_at && (
                      <button
                        onClick={() => onVerify(d.id)}
                        disabled={busy === d.id}
                        className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                      >
                        {busy === d.id ? "Checking…" : "Verify"}
                      </button>
                    )}
                    {d.verified_at && !d.is_primary && (
                      <button
                        onClick={() => onMakePrimary(d.id)}
                        disabled={busy === d.id}
                        className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                      >
                        Make primary
                      </button>
                    )}
                    <button
                      onClick={() => onRemove(d.id)}
                      disabled={busy === d.id}
                      className="rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">How custom domains work — two-step setup</p>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li>
            <span className="font-medium text-foreground">Verify ownership here.</span> Add the TXT
            record shown above at your registrar, wait for DNS to propagate, then click <em>Verify</em>.
            This proves you own the domain.
          </li>
          <li>
            <span className="font-medium text-foreground">Connect the domain to hosting.</span> Open
            your project's <em>Project Settings → Domains</em> and add the same domain there. That
            step issues an SSL certificate and routes incoming traffic to your published site.
          </li>
          <li>
            <span className="font-medium text-foreground">Pick a default page.</span> Once verified
            and connected, requests to your domain resolve to the page slug you set as the default
            (<code className="rounded bg-background px-1">home</code> if unset).
          </li>
        </ol>
        <p className="mt-3 text-xs">
          Verifying here without connecting the domain in Project Settings means the TXT check
          passes, but the domain still won't serve your site.
        </p>
      </div>
    </div>
  );
}
