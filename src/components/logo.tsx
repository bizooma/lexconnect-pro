import { Link } from "@tanstack/react-router";
import logoSrc from "@/assets/lexguild-logo.png";

export function Logo({ className = "", showName = true }: { className?: string; showName?: boolean }) {
  return (
    <Link to="/" className={`inline-flex items-center ${className}`} aria-label="LexGuild">
      <img
        src={logoSrc}
        alt="LexGuild — Mentorship Platform"
        className={showName ? "h-9 w-auto" : "h-9 w-9 object-contain"}
        style={showName ? undefined : { objectPosition: "left center" }}
      />
    </Link>
  );
}
