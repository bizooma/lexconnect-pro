import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type PresencePeer = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  color: string;
  selectedSectionId: string | null;
  online_at: string;
};

const COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

export function usePagePresence(opts: {
  pageId: string;
  userId: string | null;
  name: string;
  avatarUrl: string | null;
  selectedSectionId: string | null;
  onRemoteSave?: (by: string) => void;
}) {
  const { pageId, userId, name, avatarUrl, selectedSectionId, onRemoteSave } = opts;
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onRemoteRef = useRef(onRemoteSave);
  onRemoteRef.current = onRemoteSave;

  useEffect(() => {
    if (!pageId || !userId) return;
    const ch = supabase.channel(`website-page:${pageId}`, {
      config: { presence: { key: userId } },
    });
    channelRef.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, PresencePeer[]>;
      const list: PresencePeer[] = [];
      for (const k of Object.keys(state)) {
        if (k === userId) continue;
        const p = state[k]?.[0];
        if (p) list.push(p);
      }
      setPeers(list);
    });

    ch.on("broadcast", { event: "saved" }, (payload) => {
      const by = (payload.payload as { by?: string })?.by;
      if (by && by !== userId) onRemoteRef.current?.(by);
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({
          userId,
          name,
          avatarUrl,
          color: colorFor(userId),
          selectedSectionId,
          online_at: new Date().toISOString(),
        } satisfies PresencePeer);
      }
    });

    return () => {
      void ch.unsubscribe();
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, userId]);

  // Update presence when selection / identity changes
  useEffect(() => {
    const ch = channelRef.current;
    if (!ch || !userId) return;
    void ch.track({
      userId,
      name,
      avatarUrl,
      color: colorFor(userId),
      selectedSectionId,
      online_at: new Date().toISOString(),
    } satisfies PresencePeer);
  }, [userId, name, avatarUrl, selectedSectionId]);

  const broadcastSaved = () => {
    const ch = channelRef.current;
    if (!ch || !userId) return;
    void ch.send({ type: "broadcast", event: "saved", payload: { by: userId } });
  };

  return { peers, broadcastSaved };
}
