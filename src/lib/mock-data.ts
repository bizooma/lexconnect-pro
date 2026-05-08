// Shared mock data for the BridgeTRUST Mentorship demo.
export type Attorney = {
  id: string;
  name: string;
  initials: string;
  role: "Mentor" | "Mentee" | "Both";
  firm: string;
  practice: string;
  city: string;
  years: number;
  bio: string;
  interests: string[];
  match: number;
  availability: "Weekly" | "Bi-weekly" | "Monthly";
  comm: ("Messaging" | "Voice Notes" | "Video Calls" | "Coffee Meetings")[];
};

export const ATTORNEYS: Attorney[] = [
  {
    id: "a1",
    name: "Eleanor Whitfield",
    initials: "EW",
    role: "Mentor",
    firm: "Whitfield & Hayes LLP",
    practice: "Estate Planning",
    city: "Austin, TX",
    years: 22,
    bio: "Trusts & estates partner focused on multi-generational planning. Happy to mentor on building a referral-based practice.",
    interests: ["Estate Planning", "Probate", "Business Development"],
    match: 96,
    availability: "Bi-weekly",
    comm: ["Messaging", "Coffee Meetings"],
  },
  {
    id: "a2",
    name: "Marcus Tan",
    initials: "MT",
    role: "Mentor",
    firm: "Bayfront Trial Group",
    practice: "Business Litigation",
    city: "San Francisco, CA",
    years: 18,
    bio: "First-chair trial lawyer. I coach on case strategy, depositions, and surviving the first five years of litigation.",
    interests: ["Trial Work", "Litigation Strategy", "Leadership"],
    match: 91,
    availability: "Monthly",
    comm: ["Video Calls", "Voice Notes"],
  },
  {
    id: "a3",
    name: "Priya Raman",
    initials: "PR",
    role: "Both",
    firm: "Raman Law, PLLC",
    practice: "Solo Practice",
    city: "Chicago, IL",
    years: 9,
    bio: "Solo practitioner — estate planning + small business. Looking to mentor newer solos and learn from senior trial counsel.",
    interests: ["Solo Practice", "Work-Life Balance", "Networking"],
    match: 88,
    availability: "Weekly",
    comm: ["Messaging", "Voice Notes"],
  },
  {
    id: "a4",
    name: "Jordan Reyes",
    initials: "JR",
    role: "Mentee",
    firm: "Reyes & Co.",
    practice: "Probate",
    city: "Phoenix, AZ",
    years: 2,
    bio: "Recently launched my own probate practice. Looking for guidance on client intake systems and fee structures.",
    interests: ["Probate", "Solo Practice", "Business Development"],
    match: 84,
    availability: "Weekly",
    comm: ["Messaging", "Coffee Meetings"],
  },
  {
    id: "a5",
    name: "Alicia Brennan",
    initials: "AB",
    role: "Mentor",
    firm: "Brennan Family Law",
    practice: "Family Law",
    city: "Boston, MA",
    years: 14,
    bio: "Family law partner. Mentor for women returning to practice after a career break.",
    interests: ["Work-Life Balance", "Leadership", "Networking"],
    match: 79,
    availability: "Bi-weekly",
    comm: ["Voice Notes", "Video Calls"],
  },
  {
    id: "a6",
    name: "David Okafor",
    initials: "DO",
    role: "Mentee",
    firm: "Pillar State University — 3L",
    practice: "Business Litigation",
    city: "New York, NY",
    years: 0,
    bio: "3L heading into BigLaw litigation. Eager to learn how senior attorneys think about case strategy and client management.",
    interests: ["Litigation Strategy", "Trial Work", "Networking"],
    match: 76,
    availability: "Weekly",
    comm: ["Messaging", "Video Calls"],
  },
];

export const PRACTICE_AREAS = [
  "Estate Planning",
  "Probate",
  "Business Litigation",
  "Family Law",
  "Solo Practice",
  "Trial Work",
  "Corporate",
  "Criminal Defense",
];

export const INTERESTS = [
  "Trial Work",
  "Estate Planning",
  "Probate",
  "Business Development",
  "Work-Life Balance",
  "Leadership",
  "Networking",
  "Solo Practice",
  "Litigation Strategy",
];

export const PROMPTS = [
  "What inspired you to practice law?",
  "What's one challenge you're facing right now?",
  "What professional goal are you working toward?",
  "What's one thing you wish you knew early in your career?",
  "How do you protect your time outside of work?",
];

export type Conversation = {
  id: string;
  withId: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
};

export const CONVERSATIONS: Conversation[] = [
  { id: "c1", withId: "a1", lastMessage: "Happy to share my intake checklist — I'll send a voice note tomorrow.", lastAt: "2m", unread: 2 },
  { id: "c2", withId: "a2", lastMessage: "Let's debrief the deposition prep on Thursday.", lastAt: "1h", unread: 0 },
  { id: "c3", withId: "a3", lastMessage: "Coffee next week sounds great.", lastAt: "Yesterday", unread: 0 },
];

export type Message = {
  id: string;
  from: "me" | "them";
  kind: "text" | "voice";
  body: string;
  at: string;
  duration?: string;
};

export const MESSAGES: Record<string, Message[]> = {
  c1: [
    { id: "m1", from: "them", kind: "text", body: "Welcome to the program! How can I help this week?", at: "9:02 AM" },
    { id: "m2", from: "me", kind: "text", body: "Thanks Eleanor — I'm trying to standardize my client intake. Any templates you'd recommend?", at: "9:12 AM" },
    { id: "m3", from: "them", kind: "voice", body: "voice", duration: "0:42", at: "9:18 AM" },
    { id: "m4", from: "them", kind: "text", body: "Happy to share my intake checklist — I'll send a voice note tomorrow.", at: "9:19 AM" },
  ],
};

export type Meeting = {
  id: string;
  withId: string;
  title: string;
  date: string;
  time: string;
  link: "Zoom" | "Google Meet" | "In person";
};

export const MEETINGS: Meeting[] = [
  { id: "mt1", withId: "a1", title: "Practice intake review", date: "Tue, May 12", time: "10:30 AM", link: "Zoom" },
  { id: "mt2", withId: "a2", title: "Deposition strategy debrief", date: "Thu, May 14", time: "4:00 PM", link: "Google Meet" },
  { id: "mt3", withId: "a3", title: "Coffee — quarterly check-in", date: "Mon, May 19", time: "8:15 AM", link: "In person" },
];

export const findById = (id: string) => ATTORNEYS.find((a) => a.id === id)!;
