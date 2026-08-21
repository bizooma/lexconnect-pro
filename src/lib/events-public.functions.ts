import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loadPublicEventsPage, loadPublicEventDetail } from "@/lib/events-public.server";

const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Invalid slug");

export const getPublicEventsPage = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ orgSlug: slugSchema }).parse(input))
  .handler(async ({ data }) => loadPublicEventsPage(data.orgSlug));

export const getPublicEventPage = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ orgSlug: slugSchema, slug: slugSchema }).parse(input))
  .handler(async ({ data }) => loadPublicEventDetail(data.orgSlug, data.slug));
