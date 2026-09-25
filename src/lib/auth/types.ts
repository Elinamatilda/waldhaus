export const APP_ROLES = ["admin", "employee"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type Profile = {
  id: string;
  full_name: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};