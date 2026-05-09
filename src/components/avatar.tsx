export function Avatar({
  initials,
  size = 40,
  tone = "navy",
  src,
}: {
  initials: string;
  size?: number;
  tone?: "navy" | "gold" | "muted";
  src?: string | null;
}) {
  const tones = {
    navy: "bg-gradient-navy text-gold",
    gold: "bg-gradient-gold text-primary",
    muted: "bg-muted text-foreground",
  } as const;

  if (src) {
    return (
      <img
        src={src}
        alt={initials}
        className="inline-block shrink-0 rounded-full object-cover ring-1 ring-inset ring-white/10"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-serif font-semibold ring-1 ring-inset ring-white/10 ${tones[tone]}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}
