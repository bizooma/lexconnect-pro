import { Link } from "@tanstack/react-router";

export function Logo({ className = "", showName = true }: { className?: string; showName?: boolean }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-navy shadow-elegant">
        <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-gold" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 18c4-6 12-6 16 0" />
          <path d="M4 18v2M20 18v2" />
          <path d="M12 4v8" />
          <circle cx="12" cy="13" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      </span>
      {showName && (
        <span className="flex flex-col leading-none">
          <span className="font-serif text-[15px] font-semibold tracking-tight text-foreground">
            Bridge<span className="text-gold">TRUST</span>
          </span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Mentorship
          </span>
        </span>
      )}
    </Link>
  );
}
