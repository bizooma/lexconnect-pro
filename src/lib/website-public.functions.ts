import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loadPublicPage } from "@/lib/website-public.server";
import { resolveSiteHostTarget } from "@/lib/website-host-resolve.server";

const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Invalid slug");

export const getPublicPage = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ orgSlug: slugSchema, slug: slugSchema }).parse(input),
  )
  .handler(async ({ data }) => loadPublicPage(data.orgSlug, data.slug));

/**
 * Host-aware page load for verified SITE-mode custom domains.
 * Renders in place at clean paths — no redirect to /p/<orgSlug>/<slug>.
 * Returns { page: null } when the host isn't a site-mode tenant domain.
 */
export const getHostPage = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ slug: slugSchema.nullable().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const target = await resolveSiteHostTarget();
    if (!target) return { page: null as null | Awaited<ReturnType<typeof loadPublicPage>> };
    const slug = data.slug || target.defaultSlug;
    return { page: await loadPublicPage(target.orgSlug, slug) };
  });
