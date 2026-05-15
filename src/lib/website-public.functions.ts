import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  WebsitePage,
  WebsiteSection,
  WebsiteBrandSettings,
} from "@/lib/website";

const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Invalid slug");

export type PublicPageBundle = {
  organization: { id: string; name: string; slug: string; logo_url: string | null };
  page: WebsitePage;
  sections: WebsiteSection[];
  brand: WebsiteBrandSettings | null;
};

export const getPublicPage = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ orgSlug: slugSchema, slug: slugSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .select("id,name,slug,logo_url,paused")
      .eq("slug", data.orgSlug)
      .maybeSingle();
    if (orgErr) throw new Error(orgErr.message);
    if (!org || org.paused) throw new Error("Page not found");

    const { data: page, error: pageErr } = await supabaseAdmin
      .from("website_pages")
      .select("*")
      .eq("organization_id", org.id)
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (pageErr) throw new Error(pageErr.message);
    if (!page) throw new Error("Page not found");

    const [sectionsRes, brandRes] = await Promise.all([
      supabaseAdmin
        .from("website_sections")
        .select("*")
        .eq("page_id", page.id)
        .eq("visible", true)
        .order("display_order", { ascending: true }),
      supabaseAdmin
        .from("website_brand_settings")
        .select("*")
        .eq("organization_id", org.id)
        .maybeSingle(),
    ]);
    if (sectionsRes.error) throw new Error(sectionsRes.error.message);
    if (brandRes.error) throw new Error(brandRes.error.message);

    return {
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo_url: org.logo_url,
      },
      page: page as WebsitePage,
      sections: (sectionsRes.data ?? []) as WebsiteSection[],
      brand: (brandRes.data ?? null) as WebsiteBrandSettings | null,
    };
  });
