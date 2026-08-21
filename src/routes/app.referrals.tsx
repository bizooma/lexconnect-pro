import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Phone, Inbox, Send } from "lucide-react";

export const Route = createFileRoute("/app/referrals")({
  head: () => ({
    meta: [
      { title: "Referrals — LexGuild" },
      {
        name: "description",
        content: "Send and manage attorney-to-attorney client referrals with your organization.",
      },
      { property: "og:title", content: "Referrals — LexGuild" },
      {
        property: "og:description",
        content: "Send and manage attorney-to-attorney client referrals with your organization.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReferralsPage,
});

type Referral = {
  id: string;
  organization_id: string;
  from_user_id: string;
  to_user_id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  matter_type: string | null;
  description: string | null;
  urgency: string;
  status: string;
  response_note: string | null;
  responded_at: string | null;
  created_at: string;
};

type PersonInfo = { full_name: string | null; firm: string | null };

function urgencyClass(u: string) {
  if (u === "high") return "border-destructive/40 text-destructive";
  if (u === "low") return "text-muted-foreground";
  return "text-foreground";
}

function statusVariant(s: string): "default" | "secondary" | "outline" {
  if (s === "accepted") return "default";
  if (s === "pending") return "outline";
  return "secondary";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ReferralsPage() {
  const { user } = useAuth();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [people, setPeople] = useState<Record<string, PersonInfo>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("member_referrals")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Could not load referrals", { description: error.message });
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as Referral[];
    setReferrals(rows);

    const ids = Array.from(
      new Set(rows.flatMap((r) => [r.from_user_id, r.to_user_id]).filter(Boolean)),
    );
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, firm")
        .in("user_id", ids);
      const map: Record<string, PersonInfo> = {};
      for (const p of profs ?? []) {
        map[p.user_id] = { full_name: p.full_name, firm: p.firm };
      }
      setPeople(map);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const received = useMemo(
    () => referrals.filter((r) => r.to_user_id === user?.id),
    [referrals, user?.id],
  );
  const sent = useMemo(
    () => referrals.filter((r) => r.from_user_id === user?.id),
    [referrals, user?.id],
  );

  const respond = async (id: string, status: string, note: string) => {
    const { error } = await supabase.rpc("respond_to_member_referral", {
      _referral_id: id,
      _status: status,
      _response_note: note.trim().slice(0, 1000),
    });
    if (error) {
      toast.error("Could not update referral", { description: error.message });
      return false;
    }
    toast.success(`Referral ${status}`);
    await load();
    return true;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-foreground">Referrals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Attorney-to-attorney client referrals within your organization.
        </p>
      </header>

      <Tabs defaultValue="received">
        <TabsList>
          <TabsTrigger value="received" className="gap-2">
            <Inbox className="h-4 w-4" /> Received ({received.length})
          </TabsTrigger>
          <TabsTrigger value="sent" className="gap-2">
            <Send className="h-4 w-4" /> Sent ({sent.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="mt-5 space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : received.length === 0 ? (
            <EmptyState text="No referrals have been sent to you yet." />
          ) : (
            received.map((r) => (
              <ReceivedCard
                key={r.id}
                referral={r}
                sender={people[r.from_user_id]}
                onRespond={respond}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="sent" className="mt-5 space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : sent.length === 0 ? (
            <EmptyState text="You haven't sent any referrals yet. Find a colleague in the Directory." />
          ) : (
            sent.map((r) => (
              <SentCard
                key={r.id}
                referral={r}
                recipient={people[r.to_user_id]}
                onRespond={respond}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function MetaRow({ referral }: { referral: Referral }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Badge variant={statusVariant(referral.status)}>{referral.status}</Badge>
      <Badge variant="outline" className={urgencyClass(referral.urgency)}>
        {referral.urgency} urgency
      </Badge>
      {referral.matter_type && <Badge variant="secondary">{referral.matter_type}</Badge>}
      <span className="text-muted-foreground">{formatDate(referral.created_at)}</span>
    </div>
  );
}

function ReceivedCard({
  referral,
  sender,
  onRespond,
}: {
  referral: Referral;
  sender?: PersonInfo;
  onRespond: (id: string, status: string, note: string) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"accepted" | "declined" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            From {sender?.full_name ?? "A member"}
            {sender?.firm ? ` · ${sender.firm}` : ""}
          </p>
          <p className="mt-1 font-serif text-lg font-semibold text-foreground">
            {referral.client_name}
          </p>
        </div>
        <MetaRow referral={referral} />
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        {referral.client_email && (
          <a
            href={`mailto:${referral.client_email}`}
            className="inline-flex items-center gap-1.5 text-primary hover:underline"
          >
            <Mail className="h-3.5 w-3.5" />
            {referral.client_email}
          </a>
        )}
        {referral.client_phone && (
          <a
            href={`tel:${referral.client_phone}`}
            className="inline-flex items-center gap-1.5 text-primary hover:underline"
          >
            <Phone className="h-3.5 w-3.5" />
            {referral.client_phone}
          </a>
        )}
      </div>

      {referral.description && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
          {referral.description}
        </p>
      )}

      {referral.response_note && (
        <p className="mt-3 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          Your note: {referral.response_note}
        </p>
      )}

      {referral.status === "pending" && (
        <div className="mt-4 space-y-3">
          {mode && (
            <Textarea
              rows={3}
              placeholder={
                mode === "accepted"
                  ? "Optional note back to the referring attorney."
                  : "Let them know why (optional)."
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
            />
          )}
          <div className="flex flex-wrap gap-2">
            {mode ? (
              <>
                <Button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const ok = await onRespond(referral.id, mode, note);
                    setBusy(false);
                    if (ok) {
                      setMode(null);
                      setNote("");
                    }
                  }}
                >
                  {busy ? "Saving…" : mode === "accepted" ? "Confirm accept" : "Confirm decline"}
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => setMode(null)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => setMode("accepted")}>Accept</Button>
                <Button variant="outline" onClick={() => setMode("declined")}>
                  Decline
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function SentCard({
  referral,
  recipient,
  onRespond,
}: {
  referral: Referral;
  recipient?: PersonInfo;
  onRespond: (id: string, status: string, note: string) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const canClose = referral.status !== "closed";

  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            To {recipient?.full_name ?? "A member"}
            {recipient?.firm ? ` · ${recipient.firm}` : ""}
          </p>
          <p className="mt-1 font-serif text-lg font-semibold text-foreground">
            {referral.client_name}
          </p>
        </div>
        <MetaRow referral={referral} />
      </div>

      {referral.description && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
          {referral.description}
        </p>
      )}

      {referral.response_note && (
        <p className="mt-3 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          Response: {referral.response_note}
        </p>
      )}

      {canClose && (
        <div className="mt-4">
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onRespond(referral.id, "closed", "");
              setBusy(false);
            }}
          >
            {busy ? "Closing…" : "Close referral"}
          </Button>
        </div>
      )}
    </article>
  );
}
