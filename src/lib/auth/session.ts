import "server-only";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { forbidden, unauthorized } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUser } from "./verified-user";
import type {
  AppRole,
  Organization,
  OrganizationMembership,
  Profile,
} from "./types";

type AuthContext = {
  user: User;
  profile: Profile;
  membership: OrganizationMembership | null;
  organization: Organization | null;
};

type MemberAuthContext = AuthContext & {
  membership: OrganizationMembership;
  organization: Organization;
};

function normalizeAppRole(value: string | null | undefined): AppRole | null {
  // Match the database's canonical role predicates exactly.
  if (value === "ADMIN") return "admin";
  if (value === "EMPLOYEE") return "employee";
  return null;
}

const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const supabase = await createClient();
  const user = await getVerifiedUser(supabase.auth);
  if (!user) return null;

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, is_active, is_system_admin, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error("Failed to load the current profile.", { cause: profileError });
  }
  if (!profileRow) {
    throw new Error("Verified user has no application profile.");
  }
  const profile = profileRow as Profile;

  // An inactive account is rejected by requireProfile/requireUser. Platform
  // admins need no membership. Neither case needs an organization lookup.
  if (!profile.is_active || profile.is_system_admin) {
    return { user, profile, membership: null, organization: null };
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select(
      "id, organization_id, user_id, role_id, is_active, created_at, updated_at, organizations(id, name, slug, created_at, updated_at), roles!organization_members_role_id_fkey(code, scope, is_active)",
    )
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1);

  if (membershipError) {
    throw new Error("Failed to load the current membership.", { cause: membershipError });
  }

  type RoleRow = { code: string; scope: string; is_active: boolean };
  const row = memberships?.[0] as {
    id: string;
    organization_id: string;
    user_id: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    organizations: Organization | Organization[] | null;
    roles: RoleRow | RoleRow[] | null;
  } | undefined;
  const organization = Array.isArray(row?.organizations)
    ? row.organizations[0] ?? null
    : row?.organizations ?? null;
  const roleRow = Array.isArray(row?.roles) ? row.roles[0] : row?.roles;
  const role = roleRow?.is_active && roleRow.scope === "ORGANIZATION"
    ? normalizeAppRole(roleRow.code)
    : null;

  const membership: OrganizationMembership | null =
    row && row.is_active && row.user_id === user.id &&
    organization && organization.id === row.organization_id && role
      ? {
          id: row.id,
          organization_id: row.organization_id,
          user_id: row.user_id,
          role,
          is_active: row.is_active,
          created_at: row.created_at,
          updated_at: row.updated_at,
          organization,
        }
      : null;

  return { user, profile, membership, organization: membership?.organization ?? null };
});

export async function getCurrentUser() {
  return (await getAuthContext())?.user ?? null;
}

export async function getCurrentProfile() {
  return (await getAuthContext())?.profile ?? null;
}

export async function getCurrentMembership() {
  return (await getAuthContext())?.membership ?? null;
}

export async function getCurrentOrganization() {
  return (await getAuthContext())?.organization ?? null;
}

export async function getCurrentAuthContext() {
  return getAuthContext();
}

export async function isCurrentUserSystemAdmin() {
  const context = await getAuthContext();

  return Boolean(context?.profile.is_system_admin && context.profile.is_active);
}

export async function requireUser() {
  const context = await getAuthContext();

  if (!context) {
    unauthorized();
  }

  if (!context.profile.is_active) {
    forbidden();
  }

  return context.user;
}

export async function requireProfile() {
  const context = await getAuthContext();

  if (!context) {
    unauthorized();
  }

  if (!context.profile.is_active) {
    forbidden();
  }

  return context;
}

export async function requireMembership(): Promise<MemberAuthContext> {
  const context = await requireProfile();

  if (!context.membership || !context.organization) {
    forbidden();
  }

  return {
    ...context,
    membership: context.membership,
    organization: context.organization,
  };
}

export async function requireRole(...roles: AppRole[]) {
  const context = await requireProfile();

  if (context.profile.is_system_admin) {
    return context;
  }

  if (!context.membership || !context.organization) {
    forbidden();
  }

  if (!roles.includes(context.membership.role)) {
    forbidden();
  }

  return context;
}
