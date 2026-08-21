import { createServerFn } from "@tanstack/react-start";

export const seedRiverbendMembers = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data }) => {
    try {
      const mod = await import("@/lib/demo-seed.server");
      await mod.assertSeedAuthorized(data.accessToken);
      const result = await mod.runRiverbendSeed();
      return { ok: true as const, error: null as string | null, ...result };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Seed failed";
      console.error("[seedRiverbendMembers]", e);
      return {
        ok: false as const,
        error: message,
        membersCreated: 0,
        membersSkipped: 0,
        mentorships: 0,
        participants: 0,
        checkins: 0,
        preferences: 0,
        password: null as string | null,
      };
    }
  });
