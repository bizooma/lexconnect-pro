import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { usePortalContext, type PortalContext } from "@/hooks/use-portal-context";

type Ctx = {
  portal: PortalContext | null;
  loading: boolean;
  displayName: string | null;
  showPoweredBy: boolean;
};

const PortalThemeContext = createContext<Ctx>({
  portal: null,
  loading: true,
  displayName: null,
  showPoweredBy: false,
});

export function PortalThemeProvider({ children }: { children: ReactNode }) {
  const { portal, loading } = usePortalContext();
  const displayName = portal ? portal.portal_name || portal.name : null;

  // Set document title suffix + favicon whenever the portal changes.
  useEffect(() => {
    if (!portal || typeof document === "undefined") return;
    const prevTitle = document.title;
    if (displayName) document.title = displayName;

    let faviconEl: HTMLLinkElement | null = null;
    if (portal.favicon_url) {
      faviconEl = document.createElement("link");
      faviconEl.rel = "icon";
      faviconEl.href = portal.favicon_url;
      faviconEl.setAttribute("data-portal-favicon", "true");
      document.head.appendChild(faviconEl);
    }
    return () => {
      document.title = prevTitle;
      if (faviconEl?.parentNode) faviconEl.parentNode.removeChild(faviconEl);
    };
  }, [portal, displayName]);

  const value = useMemo<Ctx>(
    () => ({
      portal,
      loading,
      displayName,
      // Server-authoritative: show_powered_by is computed in getPortalContext
      // from the org's subscription plan. UI cannot flip this.
      showPoweredBy: Boolean(portal?.show_powered_by),
    }),
    [portal, loading, displayName],
  );

  return (
    <PortalThemeContext.Provider value={value}>
      {portal?.accent_color && (
        <style
          // Override primary token to the org's accent color. Utilities like
          // bg-primary, text-primary, ring-primary all resolve to var(--primary).
          dangerouslySetInnerHTML={{
            __html: `:root, .dark { --primary: ${cssColor(portal.accent_color)}; }`,
          }}
        />
      )}
      {children}
    </PortalThemeContext.Provider>
  );
}

export function usePortalTheme() {
  return useContext(PortalThemeContext);
}

// Only allow safe CSS color values into the injected style tag.
function cssColor(raw: string): string {
  const v = raw.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v;
  if (/^(rgb|rgba|hsl|hsla|oklch|oklab)\([^;{}<>]+\)$/.test(v)) return v;
  return "#1c2540";
}
