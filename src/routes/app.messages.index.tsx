import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { initialsOf } from "@/hooks/use-profiles";

export const Route = createFileRoute("/app/messages/")({
  component: Messages,
});

type ConversationRow = {
  id: string;
  last_message_at: string;
  participants: { user_id: string }[];
};

type Preview = {
  conversationId: string;
  otherId: string | null;
  otherName: string | null;
  otherAvatar: string | null;
  lastMessage: string | null;
  lastAt: string;
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function Messages() {
  const { user } = useAuth();
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: convs } = await supabase
      .from("conversations")
      .select("id,last_message_at,participants:conversation_participants(user_id)")
      .order("last_message_at", { ascending: false });

    const rows = (convs as ConversationRow[] | null) ?? [];
    const otherIds = rows
      .map((c) => c.participants?.find((p) => p.user_id !== user.id)?.user_id)
      .filter(Boolean) as string[];

    const [{ data: profiles }, ...lastMsgs] = await Promise.all([
      otherIds.length
        ? supabase
            .from("profiles")
            .select("user_id,full_name,avatar_url")
            .in("user_id", otherIds)
        : Promise.resolve({ data: [] as any[] }),
      ...rows.map((c) =>
        supabase
          .from("messages")
          .select("body,kind,created_at")
          .eq("conversation_id", c.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ),
    ]);
    const pmap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
    (profiles ?? []).forEach((p: any) => pmap.set(p.user_id, p));

    const out: Preview[] = rows.map((c, i) => {
      const otherId = c.participants?.find((p) => p.user_id !== user.id)?.user_id ?? null;
      const op = otherId ? pmap.get(otherId) : null;
      const last = lastMsgs[i]?.data as { body: string; kind: string } | null;
      return {
        conversationId: c.id,
        otherId,
        otherName: op?.full_name ?? null,
        otherAvatar: op?.avatar_url ?? null,
        lastMessage: last
          ? last.kind === "voice"
            ? "🎙 Voice note"
            : last.body
          : "Conversation started",
        lastAt: c.last_message_at,
      };
    });
    setPreviews(out);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`conversations-list:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-10">
      <h1 className="font-serif text-2xl font-semibold text-foreground lg:text-3xl">Messages</h1>
      <p className="mt-1 text-sm text-muted-foreground">One-on-one mentorship conversations.</p>

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading conversations…</p>
      ) : previews.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
          <p className="font-medium text-foreground">No conversations yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Conversations start automatically once a mentorship is accepted.
          </p>
          <Link to="/app/discover" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-elegant hover:bg-primary/90">
            Find a mentor
          </Link>
        </div>
      ) : (
        <div className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {previews.map((c) => (
            <Link
              key={c.conversationId}
              to="/app/messages/$id"
              params={{ id: c.conversationId }}
              className="flex items-center gap-3 p-4 transition hover:bg-accent/50"
            >
              <Avatar initials={initialsOf(c.otherName)} src={c.otherAvatar} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    {c.otherName || "Member"}
                  </p>
                  <span className="text-[11px] text-muted-foreground">{timeAgo(c.lastAt)}</span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{c.lastMessage}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
