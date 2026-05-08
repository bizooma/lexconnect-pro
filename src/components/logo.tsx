import { Link } from "@tanstack/react-router";

export function Logo({ className = "", showName = true }: { className?: string; showName?: boolean }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-navy shadow-elegant">
        <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
        {/* Abstract guild emblem — interlocking 'L' + ring of connected nodes */}
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-gold" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8.2" opacity="0.45" />
          <path d="M9 7v10h6" strokeWidth="2.2" />
          <circle cx="12" cy="3.8" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="20.2" cy="12" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="20.2" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="3.8" cy="12" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      </span>
      {showName && (
        <span className="flex flex-col leading-none">
          <span className="font-serif text-[16px] font-semibold tracking-tight text-foreground">
            Lex<span className="text-gold">Guild</span>
          </span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Legal Network
          </span>
        </span>
      )}
    </Link>
  );
}
