import { createContext, useContext, type ReactNode } from "react";

/**
 * Base path for public tenant-site links.
 * "" on a verified custom domain (clean paths: /, /<slug>, /sponsors)
 * "/p/<orgSlug>" on lexguild.com and preview hosts.
 */
const SiteBaseContext = createContext<string>("");

export function SiteBaseProvider({ basePath, children }: { basePath: string; children: ReactNode }) {
  return <SiteBaseContext.Provider value={basePath}>{children}</SiteBaseContext.Provider>;
}

export function useSiteBase(): string {
  return useContext(SiteBaseContext);
}

export function siteHref(base: string, path: string): string {
  if (path === "/" || path === "") return base || "/";
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export function homeHref(base: string, defaultSlug = "home"): string {
  return base ? `${base}/${defaultSlug}` : "/";
}
