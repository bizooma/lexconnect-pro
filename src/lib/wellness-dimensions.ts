export const WELLNESS_DIMENSIONS = [
  "physical_activity",
  "stress_management",
  "sleep",
  "nutrition",
  "social_connection",
  "career_satisfaction",
  "mindfulness",
  "community_service",
  "work_life_boundaries",
  "professional_development",
] as const;

export type WellnessDimension = (typeof WELLNESS_DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<string, string> = {
  physical_activity: "Physical activity",
  stress_management: "Stress management",
  sleep: "Sleep",
  nutrition: "Nutrition",
  social_connection: "Social connection",
  career_satisfaction: "Career satisfaction",
  mindfulness: "Mindfulness",
  community_service: "Community & service",
  work_life_boundaries: "Work-life boundaries",
  professional_development: "Professional development",
};

export const dimensionLabel = (d: string) =>
  DIMENSION_LABELS[d] ?? d.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
