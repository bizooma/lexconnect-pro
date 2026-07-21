import { getRequestHost, getRequestHeader } from "@tanstack/react-start/server";

// Returns the effective inbound host, preferring x-forwarded-host (the
// hosting proxy rewrites Host in production). Lowercased, port-stripped.
export function getEffectiveHost(): string {
  let xfh = "";
  try {
    xfh = getRequestHeader("x-forwarded-host") ?? "";
  } catch {
    xfh = "";
  }
  let host = "";
  if (xfh) {
    host = xfh.split(",")[0]?.trim() ?? "";
  }
  if (!host) {
    try {
      host = getRequestHost() || "";
    } catch {
      host = "";
    }
  }
  host = host.toLowerCase().replace(/:\d+$/, "");
  return host;
}
