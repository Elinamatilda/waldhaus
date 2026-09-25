export const APP_ROLES = ["admin", "employee"] as const;

export type AppRole = (typeof APP_ROLES)[number];
export type PlatformRole = "system_admin";
export type AccessRole = PlatformRole | AppRole;

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_system_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
};

export type OrganizationMembership = {
  id: string;
  organization_id: string;
  user_id: string;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  organization: Organization;
};