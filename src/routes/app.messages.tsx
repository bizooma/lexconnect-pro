import { createFileRoute, Link } from "@tanstack/react-router";
import { CONVERSATIONS, findById } from "@/lib/mock-data";
import { Avatar } from "@/components/avatar";

export const Route = createFileRoute("/app/messages")({
  component: Messages,
});

function Messages() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-10">
      <h1 className="font-serif text-2xl font-semibold text-foreground lg:text-3xl">Messages</h1>
      <p className="mt-1 text-sm text-muted-foreground">One-on-one mentorship conversations.</p>
      <div className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {CONVERSATIONS.map((c) => {
          const a = findById(c.withId);
          return (
            <Link key={c.id} to="/app/messages/$id" params={{ id: c.id }} className="flex items-center gap-3 p-4 transition hover:bg-accent/50">
              <Avatar initials={a.initials} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                  <span className="text-[11px] text-muted-foreground">{c.lastAt}</span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{c.lastMessage}</p>
              </div>
              {c.unread > 0 && <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-semibold text-gold-foreground">{c.unread}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
