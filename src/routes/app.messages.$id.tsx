import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CONVERSATIONS, MESSAGES, PROMPTS, findById, type Message } from "@/lib/mock-data";
import { Avatar } from "@/components/avatar";

export const Route = createFileRoute("/app/messages/$id")({
  component: Thread,
});

function Thread() {
  const { id } = Route.useParams();
  const conv = CONVERSATIONS.find((c) => c.id === id) ?? CONVERSATIONS[0];
  const a = findById(conv.withId);
  const [draft, setDraft] = useState("");
  const [showPrompts, setShowPrompts] = useState(false);
  const [recording, setRecording] = useState(false);
  const [msgs, setMsgs] = useState<Message[]>(MESSAGES[conv.id] ?? MESSAGES.c1);

  const send = (body: string, kind: Message["kind"] = "text", duration?: string) => {
    if (!body.trim() && kind === "text") return;
    setMsgs([...msgs, { id: `n${msgs.length}`, from: "me", kind, body, at: "now", duration }]);
    setDraft("");
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-background lg:h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 shadow-card">
        <Link to="/app/messages" className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Link>
        <Avatar initials={a.initials} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{a.name}</p>
          <p className="truncate text-xs text-success">● Online · typing…</p>
        </div>
        <button className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round"/></svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
        <p className="text-center text-[11px] uppercase tracking-wider text-muted-foreground">Today</p>
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-card ${m.from === "me" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-card text-foreground"}`}>
              {m.kind === "voice" ? (
                <div className="flex items-center gap-3 py-1">
                  <button className={`flex h-9 w-9 items-center justify-center rounded-full ${m.from === "me" ? "bg-white/15" : "bg-primary text-primary-foreground"}`}>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  </button>
                  <div className="flex h-6 items-end gap-0.5">
                    {[6,12,18,10,14,8,16,12,9,14,7,12].map((h, i) => (
                      <span key={i} className={`w-0.5 rounded-full ${m.from === "me" ? "bg-white/60" : "bg-primary/60"}`} style={{ height: h }} />
                    ))}
                  </div>
                  <span className="text-xs opacity-80">{m.duration}</span>
                </div>
              ) : (
                <p className="leading-relaxed">{m.body}</p>
              )}
              <p className={`mt-1 text-[10px] ${m.from === "me" ? "text-white/60" : "text-muted-foreground"}`}>{m.at}{m.from === "me" ? " · Read" : ""}</p>
            </div>
          </div>
        ))}
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
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(draft); } }}
            placeholder="Write a message…"
            className="block max-h-32 flex-1 resize-none rounded-2xl border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none ring-ring/30 focus:ring-2"
          />
          {draft.trim() ? (
            <button onClick={() => send(draft)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elegant hover:bg-primary/90">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          ) : (
            <button
              onMouseDown={() => setRecording(true)}
              onMouseUp={() => { setRecording(false); send("voice", "voice", "0:08"); }}
              onMouseLeave={() => recording && (setRecording(false), send("voice", "voice", "0:08"))}
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
