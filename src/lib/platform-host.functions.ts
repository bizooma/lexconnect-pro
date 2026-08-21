import { createServerFn } from "@tanstack/react-start";

// True only for the LexGuild platform hosts (never a tenant custom domain).
const PLATFORM_HOST_SUFFIXES = ["lexguild.com", "lovable.app", "lovable.dev", "localhost"];

export const isPlatformHost = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { getEffectiveHost } = await import("@/lib/website-host.server");
    const host = getEffectiveHost();
    if (!host) return false;
    return PLATFORM_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
  } catch {
    return false;
  }
});
