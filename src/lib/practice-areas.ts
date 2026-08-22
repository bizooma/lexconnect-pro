export const PRACTICE_AREAS = [
  { value: "personal_injury", label: "Personal Injury" },
  { value: "family_law", label: "Family Law" },
  { value: "criminal_defense", label: "Criminal Defense" },
  { value: "estate_planning", label: "Estate Planning" },
  { value: "immigration", label: "Immigration" },
  { value: "business_law", label: "Business Law" },
  { value: "real_estate", label: "Real Estate" },
  { value: "employment", label: "Employment" },
  { value: "bankruptcy", label: "Bankruptcy" },
  { value: "civil_litigation", label: "Civil Litigation" },
  { value: "other", label: "Other" },
] as const;

export function practiceAreaLabel(value: string): string {
  return PRACTICE_AREAS.find((a) => a.value === value)?.label ?? value;
}
