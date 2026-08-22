import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loadPublicReferralIntakePage } from "@/lib/lrs-public.server";

const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Invalid slug");

export const getPublicReferralIntakePage = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ orgSlug: slugSchema }).parse(input))
  .handler(async ({ data }) => loadPublicReferralIntakePage(data.orgSlug));
