import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { initialsOf } from "@/hooks/use-profiles";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResourceUploader } from "@/components/resources/resource-uploader";
import { ResourceCard } from "@/components/resources/resource-card";
import type { ResourceRow } from "@/lib/resources";

export const Route = createFileRoute("/app/messages/$id")({
  component: Thread,
});

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  kind: "text" | "voice";
  audio_url: string | null;
  duration_seconds: number | null;
  created_at: string;
};

const PROMPTS = [
  "What's a recent case that taught you something?",
  "How do you balance practice and personal time?",
  "Any advice on building a referral network?",
  "What would you have done differently in your first year?",
];

function Thread() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [other, setOther] = useState<{ user_id: string; full_name: string | null; avatar_url: string | null } | null>(null);
  const [draft, setDraft] = useState("");
  const [showPrompts, setShowPrompts] = useState(false);
  const [recording, setRecording] = useState(false);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [orgId, setOrgId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Record<string, ResourceRow[]>>({});
  const [uploadOpen, setUploadOpen] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load messages + other participant
  const load = async () => {
    const [{ data: messages }, { data: parts }, { data: conv }] = await Promise.all([
      supabase
        .from("messages")
        .select("id,conversation_id,sender_id,body,kind,audio_url,duration_seconds,created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", id),
      supabase
        .from("conversations")
        .select("organization_id")
        .eq("id", id)
        .maybeSingle(),
    ]);
    setMsgs((messages as Message[] | null) ?? []);
    setOrgId((conv as { organization_id: string } | null)?.organization_id ?? null);
    const otherId = (parts ?? []).map((p: any) => p.user_id).find((uid) => uid !== user?.id);
    if (otherId) {
      const { data: p } = await supabase
        .from("profiles")
        .select("user_id,full_name,avatar_url")
        .eq("user_id", otherId)
        .maybeSingle();
      setOther(p as any);
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user, id]);

  // Realtime new messages
  useEffect(() => {
    const channel = supabase
      .channel(`thread:${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          setMsgs((prev) => {
            if (prev.some((m) => m.id === (payload.new as Message).id)) return prev;
            return [...prev, payload.new as Message];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);

  // Sign voice URLs as they appear
  useEffect(() => {
    const toSign = msgs.filter((m) => m.kind === "voice" && m.audio_url && !signed[m.id]);
    if (toSign.length === 0) return;
    (async () => {
      const updates: Record<string, string> = {};
      for (const m of toSign) {
        const { data } = await supabase.storage
          .from("voice-notes")
          .createSignedUrl(m.audio_url!, 60 * 60);
        if (data?.signedUrl) updates[m.id] = data.signedUrl;
      }
      if (Object.keys(updates).length) setSigned((s) => ({ ...s, ...updates }));
    })();
  }, [msgs]);

  // Load resource attachments for current messages
  useEffect(() => {
    const ids = msgs.map((m) => m.id);
    if (ids.length === 0) { setAttachments({}); return; }
    (async () => {
      const { data } = await supabase
        .from("message_resources")
        .select("message_id, resources(*)")
        .in("message_id", ids);
      const map: Record<string, ResourceRow[]> = {};
      for (const row of (data ?? []) as any[]) {
        if (!row.resources) continue;
        (map[row.message_id] ||= []).push(row.resources as ResourceRow);
      }
      setAttachments(map);
    })();
  }, [msgs]);

  const sendText = async (body: string) => {
    if (!user || !body.trim()) return;
    setDraft("");
    const { error } = await supabase.from("messages").insert({
      conversation_id: id,
      sender_id: user.id,
      body: body.trim(),
      kind: "text",
    });
    if (error) toast.error(error.message);
  };

  const handleResourceUploaded = async (resource: ResourceRow) => {
    if (!user) return;
    // Insert a placeholder message and link the resource
    const { data: msg, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: id,
        sender_id: user.id,
        body: "",
        kind: "text",
      })
      .select("id")
      .single();
    if (error || !msg) { toast.error(error?.message ?? "Could not attach"); return; }
    const { error: linkErr } = await supabase
      .from("message_resources")
      .insert({ message_id: msg.id, resource_id: resource.id });
    if (linkErr) { toast.error(linkErr.message); return; }
    setAttachments((a) => ({ ...a, [msg.id]: [resource] }));
    setUploadOpen(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const duration = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        const ext = (rec.mimeType || "audio/webm").includes("mp4") ? "mp4" : "webm";
        const path = `${id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("voice-notes")
          .upload(path, blob, { contentType: blob.type });
        if (upErr) { toast.error(upErr.message); return; }
        const { error: msgErr } = await supabase.from("messages").insert({
          conversation_id: id,
          sender_id: user!.id,
          body: "",
          kind: "voice",
          audio_url: path,
          duration_seconds: duration,
        });
        if (msgErr) toast.error(msgErr.message);
      };
      recorderRef.current = rec;
      startedAtRef.current = Date.now();
      rec.start();
      setRecording(true);
    } catch (err: any) {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recording) {
      recorderRef.current.stop();
      setRecording(false);
    }
  };

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-background lg:h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 shadow-card">
        <Link to="/app/messages" className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Link>
        <Avatar initials={initialsOf(other?.full_name)} src={other?.avatar_url} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{other?.full_name || "Member"}</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
        {msgs.length === 0 && (
          <p className="text-center text-xs text-muted-foreground">No messages yet — say hello.</p>
        )}
        {msgs.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-card ${mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-card text-foreground"}`}>
                {m.kind === "voice" ? (
                  <div className="flex items-center gap-3 py-1">
                    {signed[m.id] ? (
                      <audio controls src={signed[m.id]} className="h-8 max-w-[220px]" />
                    ) : (
                      <span className="text-xs opacity-70">Loading audio…</span>
                    )}
                    {m.duration_seconds && (
                      <span className="text-xs opacity-80">{m.duration_seconds}s</span>
                    )}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                )}
                <p className={`mt-1 text-[10px] ${mine ? "text-white/60" : "text-muted-foreground"}`}>{fmtTime(m.created_at)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Prompts */}
      {showPrompts && (
        <div className="border-t border-border bg-card px-4 py-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Conversation prompts</p>
          <div className="flex flex-wrap gap-2">
            {PROMPTS.map((p) => (
              <button key={p} onClick={() => { setDraft(p); setShowPrompts(false); }} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground hover:border-primary/40">
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-border bg-card px-3 py-3">
        <div className="flex items-end gap-2">
          <button onClick={() => setShowPrompts(!showPrompts)} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${showPrompts ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`} title="Prompts">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
          </button>
          <textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(draft); } }}
            placeholder="Write a message…"
            className="block max-h-32 flex-1 resize-none rounded-2xl border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none ring-ring/30 focus:ring-2"
          />
          {draft.trim() ? (
            <button onClick={() => sendText(draft)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elegant hover:bg-primary/90">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          ) : (
            <button
              onMouseDown={startRecording}
              onTouchStart={startRecording}
              onMouseUp={stopRecording}
              onTouchEnd={stopRecording}
              onMouseLeave={() => recording && stopRecording()}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${recording ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-gradient-gold text-primary shadow-gold"}`}
              title="Hold to record voice note"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round"/></svg>
            </button>
          )}
        </div>
        {recording && <p className="mt-2 text-center text-xs text-muted-foreground">Recording… release to send</p>}
      </div>
    </div>
  );
}
