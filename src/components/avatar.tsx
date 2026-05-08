export function Avatar({ initials, size = 40, tone = "navy" }: { initials: string; size?: number; tone?: "navy" | "gold" | "muted" }) {
  const tones = {
    navy: "bg-gradient-navy text-gold",
    gold: "bg-gradient-gold text-primary",
    muted: "bg-muted text-foreground",
  } as const;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-serif font-semibold ring-1 ring-inset ring-white/10 ${tones[tone]}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}
