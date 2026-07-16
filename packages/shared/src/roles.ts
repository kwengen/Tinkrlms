export const ROLES = [
  "superadmin",
  "kundeadmin",
  "org_ansvarlig",
  "kurs_ansvarlig",
  "bruker",
] as const;

export type Role = (typeof ROLES)[number];
