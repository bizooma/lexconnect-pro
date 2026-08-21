import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const RIVERBEND_ORG_ID = "4886b3a7-cbbb-4d09-a56d-74d2cf66bcba";
export const DEMO_PASSWORD = "RiverbendDemo!2026";

type Member = {
  key: string;
  name: string;
  email: string;
  practice: string[];
  years: number;
  mentor: boolean;
  mentee: boolean;
  accepting: boolean;
  firm?: string;
  headline?: string;
  dims: string[];
};

const MEMBERS: Member[] = [
  {
    key: "whitfield",
    name: "James Whitfield",
    email: "james.whitfield@example.com",
    practice: ["Litigation", "Business Law"],
    years: 28,
    mentor: true,
    mentee: false,
    accepting: true,
    firm: "Whitfield Law Group",
    headline: "Trial attorney",
    dims: ["physical_activity", "stress_management"],
  },
  {
    key: "delgado",
    name: "Maria Delgado",
    email: "maria.delgado@example.com",
    practice: ["Family Law"],
    years: 22,
    mentor: true,
    mentee: false,
    accepting: true,
    firm: "Delgado Family Law",
    headline: "Family law advocate",
    dims: ["stress_management", "social_connection", "sleep"],
  },
  {
    key: "okafor",
    name: "David Okafor",
    email: "david.okafor@example.com",
    practice: ["Business Law"],
    years: 25,
    mentor: true,
    mentee: false,
    accepting: true,
    firm: "Okafor & Associates",
    headline: "Corporate counsel",
    dims: ["professional_development", "physical_activity"],
  },
  {
    key: "lindqvist",
    name: "Sarah Lindqvist",
    email: "sarah.lindqvist@example.com",
    practice: ["Real Estate"],
    years: 18,
    mentor: true,
    mentee: false,
    accepting: true,
    firm: "Lindqvist & Cole",
    headline: "Real estate attorney",
    dims: ["work_life_boundaries", "mindfulness"],
  },
  {
    key: "rao",
    name: "Michael Rao",
    email: "michael.rao@example.com",
    practice: ["Estate Planning"],
    years: 15,
    mentor: true,
    mentee: false,
    accepting: true,
    firm: "Rao Estate Law",
    headline: "Estate planning attorney",
    dims: ["sleep", "community_service"],
  },
  {
    key: "kowalski",
    name: "Jennifer Kowalski",
    email: "jennifer.kowalski@example.com",
    practice: ["Criminal Defense"],
    years: 12,
    mentor: true,
    mentee: true,
    accepting: true,
    headline: "Criminal defense attorney",
    dims: ["stress_management", "physical_activity", "mindfulness"],
  },
  {
    key: "bennett",
    name: "Robert Bennett",
    email: "robert.bennett@example.com",
    practice: ["Personal Injury"],
    years: 3,
    mentor: false,
    mentee: true,
    accepting: false,
    firm: "Bennett Injury Law",
    headline: "Personal injury associate",
    dims: ["professional_development", "social_connection"],
  },
  {
    key: "alvarez",
    name: "Linda Alvarez",
    email: "linda.alvarez@example.com",
    practice: ["Immigration"],
    years: 2,
    mentor: false,
    mentee: true,
    accepting: false,
    headline: "Immigration attorney",
    dims: ["community_service", "sleep"],
  },
  {
    key: "chen",
    name: "William Chen",
    email: "william.chen@example.com",
    practice: ["Business Law"],
    years: 4,
    mentor: false,
    mentee: true,
    accepting: false,
    headline: "Business law associate",
    dims: ["work_life_boundaries", "professional_development"],
  },
  {
    key: "patel",
    name: "Patricia Patel",
    email: "patricia.patel@example.com",
    practice: ["Family Law"],
    years: 1,
    mentor: false,
    mentee: true,
    accepting: false,
    headline: "New admittee",
    dims: ["mindfulness", "social_connection", "stress_management"],
  },
  {
    key: "reed",
    name: "Richard Reed",
    email: "richard.reed@example.com",
    practice: ["Real Estate"],
    years: 5,
    mentor: false,
    mentee: true,
    accepting: false,
    headline: "Real estate associate",
    dims: ["physical_activity", "work_life_boundaries"],
  },
  {
    key: "nguyen",
    name: "Barbara Nguyen",
    email: "barbara.nguyen@example.com",
    practice: ["Litigation"],
    years: 2,
    mentor: false,
    mentee: true,
    accepting: false,
    headline: "Litigation associate",
    dims: ["social_connection", "professional_development"],
  },
];

const MENTORSHIPS: {
  mentor: string;
  mentee: string;
  status: "active" | "completed";
  intro: string;
}[] = [
  {
    mentor: "whitfield",
    mentee: "bennett",
    status: "active",
    intro: "Would love guidance on building a trial practice.",
  },
  {
    mentor: "delgado",
    mentee: "patel",
    status: "active",
    intro: "Just admitted and hoping to learn family law from the ground up.",
  },
  {
    mentor: "okafor",
    mentee: "chen",
    status: "active",
    intro: "Looking for help with transactional work and client development.",
  },
  {
    mentor: "lindqvist",
    mentee: "reed",
    status: "completed",
    intro: "Wrapped up a year of real estate closings mentoring.",
  },
  {
    mentor: "rao",
    mentee: "nguyen",
    status: "active",
    intro: "Interested in moving from litigation support into estate work.",
  },
];

function day(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    for (const u of data.users) {
      if ((u.email ?? "").toLowerCase() === email) return u.id;
    }
    if (data.users.length < 1000) break;
    page++;
  }
  return null;
}

export async function runRiverbendSeed() {
  const org = RIVERBEND_ORG_ID;
  const ids: Record<string, string> = {};
  let created = 0;
  let skipped = 0;

  for (const m of MEMBERS) {
    const email = m.email.toLowerCase();
    let userId = await findUserIdByEmail(email);
    if (userId) {
      skipped++;
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: m.name },
      });
      if (error) throw new Error(`${email}: ${error.message}`);
      userId = data.user?.id ?? null;
      if (!userId) throw new Error(`${email}: no user id returned`);
      created++;
    }
    ids[m.key] = userId;

    const profile = {
      user_id: userId,
      full_name: m.name,
      practice_areas: m.practice,
      is_mentor: m.mentor,
      is_mentee: m.mentee,
      accepting_mentees: m.accepting,
      years_experience: m.years,
      firm: m.firm ?? null,
      headline: m.headline ?? null,
      city: "Jacksonville",
      state: "FL",
      communication_prefs: ["messaging", "meetings"],
      onboarded: true,
      organization_id: org,
      avatar_url: null,
    };
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin.from("profiles").update(profile).eq("user_id", userId);
    } else {
      await supabaseAdmin.from("profiles").insert(profile);
    }

    await supabaseAdmin.from("organization_members").upsert(
      {
        organization_id: org,
        user_id: userId,
        org_role: "member" as const,
        status: "active" as const,
        joined_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,user_id" },
    );

    await supabaseAdmin
      .from("org_contacts")
      .update({ user_id: userId })
      .eq("organization_id", org)
      .eq("email", email);
  }

  // Mentorships
  let mentorships = 0;
  for (const p of MENTORSHIPS) {
    const mentor = ids[p.mentor]!;
    const mentee = ids[p.mentee]!;
    const { data: existing } = await supabaseAdmin
      .from("mentorships")
      .select("id")
      .eq("organization_id", org)
      .eq("mentor_id", mentor)
      .eq("mentee_id", mentee)
      .maybeSingle();
    if (existing) continue;
    const { error } = await supabaseAdmin.from("mentorships").insert({
      organization_id: org,
      mentor_id: mentor,
      mentee_id: mentee,
      status: p.status,
      requested_by: mentee,
      intro_message: p.intro,
    });
    if (error) throw new Error(`mentorship ${p.mentor}->${p.mentee}: ${error.message}`);
    mentorships++;
  }

  // Challenges
  const { data: challenges } = await supabaseAdmin
    .from("wellness_challenges")
    .select("id,template_key")
    .eq("organization_id", org)
    .eq("status", "active");

  const byKey = new Map((challenges ?? []).map((c) => [c.template_key ?? "", c.id]));

  const plans: { key: string; members: string[]; checkins: number; value: (i: number) => number }[] =
    [
      {
        key: "walking",
        members: [
          "whitfield",
          "delgado",
          "okafor",
          "kowalski",
          "bennett",
          "chen",
          "patel",
          "reed",
        ],
        checkins: 4,
        value: (i) => 4000 + ((i * 2300) % 8000),
      },
      {
        key: "no-email-sunday",
        members: ["delgado", "lindqvist", "rao", "alvarez", "nguyen"],
        checkins: 2,
        value: () => 1,
      },
      {
        key: "meet-5",
        members: ["whitfield", "rao", "kowalski", "alvarez", "chen", "nguyen"],
        checkins: 3,
        value: () => 1,
      },
    ];

  let participants = 0;
  let checkins = 0;
  for (const plan of plans) {
    const challengeId = byKey.get(plan.key);
    if (!challengeId) continue;
    for (let mi = 0; mi < plan.members.length; mi++) {
      const uid = ids[plan.members[mi]!]!;
      const { error: pErr } = await supabaseAdmin
        .from("wellness_challenge_participants")
        .upsert(
          { challenge_id: challengeId, user_id: uid, organization_id: org },
          { onConflict: "challenge_id,user_id" },
        );
      if (!pErr) participants++;
      const n = Math.max(1, plan.checkins - (mi % 2));
      for (let d = 0; d < n; d++) {
        const { error: cErr } = await supabaseAdmin
          .from("wellness_challenge_checkins")
          .upsert(
            {
              challenge_id: challengeId,
              user_id: uid,
              organization_id: org,
              occurred_on: day(d),
              value: plan.value(mi + d),
            },
            { onConflict: "challenge_id,user_id,occurred_on" },
          );
        if (!cErr) checkins++;
      }
    }
  }

  // Wellness preferences
  let preferences = 0;
  for (const m of MEMBERS) {
    const uid = ids[m.key]!;
    for (const dim of m.dims) {
      const { error } = await supabaseAdmin
        .from("wellness_preferences")
        .upsert(
          { user_id: uid, organization_id: org, dimension: dim },
          { onConflict: "user_id,organization_id,dimension" },
        );
      if (!error) preferences++;
    }
  }

  return {
    membersCreated: created,
    membersSkipped: skipped,
    mentorships,
    participants,
    checkins,
    preferences,
    password: DEMO_PASSWORD,
  };
}

export async function assertSeedAuthorized(accessToken: string): Promise<void> {
  if (!accessToken) throw new Error("Not authenticated");
  const { data: userData, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !userData?.user) throw new Error("Invalid session");
  const userId = userData.user.id;

  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (roleRow) return;

  const { data: memberRow } = await supabaseAdmin
    .from("organization_members")
    .select("org_role")
    .eq("organization_id", RIVERBEND_ORG_ID)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (memberRow?.org_role === "owner") return;

  throw new Error("Forbidden");
}
