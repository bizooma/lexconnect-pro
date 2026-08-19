export const ORG_KIND_VALUES = [
  "firm",
  "bar_association",
  "law_school",
  "legal_nonprofit",
  "in_house",
  "attorney_group",
  "other",
] as const;

export type OrgKind = (typeof ORG_KIND_VALUES)[number];

export const ORG_KIND_LABELS: Record<OrgKind, string> = {
  firm: "Law firm",
  bar_association: "Bar association",
  law_school: "Law school",
  legal_nonprofit: "Legal nonprofit / legal aid",
  in_house: "In-house legal department",
  attorney_group: "Attorney group / specialty bar",
  other: "Other",
};

export function isOrgKind(value: string): value is OrgKind {
  return ORG_KIND_VALUES.includes(value as OrgKind);
}

export function orgKindLabel(value: string): string {
  return isOrgKind(value) ? ORG_KIND_LABELS[value] : value;
}
