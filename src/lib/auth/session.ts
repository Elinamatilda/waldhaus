import "server-only";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { forbidden, unauthorized } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

function logAuthDiagnostic(event: string, payload: Record<string, boolean | string | null | undefined>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  // Development-only auth tracing without secrets/tokens/cookie values.
  console.info("[auth][session]", event, payload);
}

function normalizeAppRole(value: string | null | undefined): AppRole | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "admin" || normalized === "employee") {
    return normalized;
  }

  return null;
}

function isRecoverableAuthError(error: {
  name?: string;
  message?: string;
  code?: string;
  status?: number;
}) {
  const message = (error.message ?? "").toLowerCase();
  const name = (error.name ?? "").toLowerCase();
  const code = (error.code ?? "").toLowerCase();

  return (
    message.includes("fetch failed") ||
    message.includes("network") ||
    name.includes("authsessionmissingerror") ||
    name.includes("typeerror") ||
    code.includes("session") ||
    code.includes("token") ||
    message.includes("auth session missing") ||
    message.includes("session not found") ||
    message.includes("invalid refresh token") ||
    message.includes("refresh token not found") ||
    message.includes("jwt") ||
    message.includes("token") ||
    error.status === 400 ||
    error.status === 401 ||
    error.status === 403
  );
}

function isSchemaCompatibilityError(error: {
  message?: string;
  code?: string;
}) {
  const message = (error.message ?? "").toLowerCase();
  const code = (error.code ?? "").toLowerCase();

  return (
    code === "42703" ||
    code === "42p01" ||
    code === "pgrst204" ||
    code === "pgrst205" ||
    message.includes("column") ||
    message.includes("does not exist") ||
    message.includes("could not find") ||
    message.includes("relationship")
  );
}

async function loadCurrentUser() {
  const firstClient = await createClient();
  const firstAttempt = await firstClient.auth.getUser();

  if (!firstAttempt.error || !isRecoverableAuthError(firstAttempt.error)) {
    return firstAttempt;
  }

  const secondClient = await createClient();
  const secondAttempt = await secondClient.auth.getUser();
  if (!secondAttempt.error || !isRecoverableAuthError(secondAttempt.error)) {
    return secondAttempt;
  }

  const {
    data: { session },
  } = await secondClient.auth.getSession();

  return {
    data: { user: session?.user ?? null },
    error: null,
  };
}

async function retryRecoverableQuery<T>(
  run: () => Promise<{ data: T; error: { message: string; name?: string; code?: string; status?: number } | null }>,
) {
  const firstAttempt = await run();

  if (!firstAttempt.error || !isRecoverableAuthError(firstAttempt.error)) {
    return firstAttempt;
  }

  return run();
}

const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const {
    data: { user },
    error: userError,
  } = await loadCurrentUser();

  if (userError) {
    // Treat common auth/session failures as signed-out state to avoid hard runtime crashes.
    if (isRecoverableAuthError(userError)) {
      logAuthDiagnostic("user_missing_recoverable", {
        hasUser: false,
        errorName: userError.name ?? null,
      });
      return null;
    }

    throw new Error(`Failed to load the current user: ${userError.message}`);
  }

  if (!user) {
    logAuthDiagnostic("user_missing", {
      hasUser: false,
    });
    return null;
  }

  logAuthDiagnostic("user_loaded", {
    hasUser: true,
  });

  const { data: profileV2, error: profileErrorV2 } = await retryRecoverableQuery(
    async () =>
      await (await createClient())
        .from("profiles")
        .select(
          "id, full_name, avatar_url, is_active, is_system_admin, created_at, updated_at",
        )
        .eq("id", user.id)
        .maybeSingle(),
  );

  if (profileErrorV2 && isRecoverableAuthError(profileErrorV2)) {
    logAuthDiagnostic("profile_fetch_failed", {
      hasUser: true,
      profileFound: false,
      errorName: profileErrorV2.name ?? null,
    });
    throw new Error(
      `Authenticated user session found, but profile lookup failed: ${profileErrorV2.message}`,
    );
  }

  if (profileErrorV2 && !isSchemaCompatibilityError(profileErrorV2)) {
    throw new Error(`Failed to load the current profile: ${profileErrorV2.message}`);
  }

  const profileQueryUsesV2Shape = !profileErrorV2;

  const { data: profileLegacy, error: profileErrorLegacy } =
    profileQueryUsesV2Shape
      ? { data: null, error: null }
        : await retryRecoverableQuery(async () =>
          await (await createClient())
            .from("profiles")
            .select("id, full_name, avatar_url, is_active, created_at, updated_at")
            .eq("id", user.id)
            .maybeSingle(),
        );

  if (!profileQueryUsesV2Shape && profileErrorLegacy && isRecoverableAuthError(profileErrorLegacy)) {
    throw new Error(
      `Authenticated user session found, but legacy profile lookup failed: ${profileErrorLegacy.message}`,
    );
  }

  if (!profileQueryUsesV2Shape && profileErrorLegacy) {
    throw new Error(
      `Failed to load the current profile: ${profileErrorLegacy.message}`,
    );
  }

  const profile = (profileV2 ?? profileLegacy) as
    | (Profile & { is_system_admin?: boolean })
    | null;

  if (!profile) {
    logAuthDiagnostic("profile_missing", {
      hasUser: true,
      profileFound: false,
    });
    return null;
  }

  const profileWithSystemAdmin: Profile = {
    id: profile.id,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
    is_active: profile.is_active,
    is_system_admin: Boolean(profile.is_system_admin),
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };

  if (profileWithSystemAdmin.is_system_admin) {
    logAuthDiagnostic("profile_loaded_system_admin", {
      hasUser: true,
      profileFound: true,
      isSystemAdmin: true,
    });
    return {
      user,
      profile: profileWithSystemAdmin,
      membership: null,
      organization: null,
    };
  }

  const { data: membershipsV2, error: membershipErrorV2 } = await retryRecoverableQuery(
    async () =>
      await (await createClient())
        .from("organization_members")
        .select(
          "id, organization_id, user_id, role_id, is_active, created_at, updated_at, organizations(id, name, slug, created_at, updated_at), roles!organization_members_role_id_fkey(code)",
        )
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1),
  );

  if (membershipErrorV2 && isRecoverableAuthError(membershipErrorV2)) {
    logAuthDiagnostic("membership_fetch_failed", {
      hasUser: true,
      profileFound: true,
      isSystemAdmin: false,
      membershipFound: false,
      errorName: membershipErrorV2.name ?? null,
    });
    throw new Error(
      `Authenticated user profile found, but membership lookup failed: ${membershipErrorV2.message}`,
    );
  }

  if (membershipErrorV2 && !isSchemaCompatibilityError(membershipErrorV2)) {
    throw new Error(
      `Failed to load the current membership: ${membershipErrorV2.message}`,
    );
  }

  const isV2QueryUsable = !membershipErrorV2;

  const { data: membershipsLegacy, error: membershipErrorLegacy } =
    isV2QueryUsable
      ? { data: null, error: null }
      : await retryRecoverableQuery(async () =>
          await (await createClient())
            .from("organization_members")
            .select(
              "id, organization_id, user_id, role, is_active, created_at, updated_at, organizations(id, name, slug, created_at, updated_at)",
            )
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("created_at", { ascending: true })
            .limit(1),
        );

  if (!isV2QueryUsable && membershipErrorLegacy && isRecoverableAuthError(membershipErrorLegacy)) {
    throw new Error(
      `Authenticated user profile found, but legacy membership lookup failed: ${membershipErrorLegacy.message}`,
    );
  }

  if (!isV2QueryUsable && membershipErrorLegacy) {
    throw new Error(
      `Failed to load the current membership: ${membershipErrorLegacy.message}`,
    );
  }

  const membershipRowV2 = membershipsV2?.[0] as
    | {
        id: string;
        organization_id: string;
        user_id: string;
        role_id: string;
        is_active: boolean;
        created_at: string;
        updated_at: string;
        organizations: Organization | Organization[] | null;
        roles:
          | { code: string }
          | Array<{ code: string }>
          | null;
      }
    | undefined;

  const membershipRowLegacy = membershipsLegacy?.[0] as
    | {
        id: string;
        organization_id: string;
        user_id: string;
        role: string;
        is_active: boolean;
        created_at: string;
        updated_at: string;
        organizations: Organization | Organization[] | null;
      }
    | undefined;

  const membershipRow = membershipRowV2 ?? membershipRowLegacy;

  const organization = Array.isArray(membershipRow?.organizations)
    ? (membershipRow.organizations[0] ?? null)
    : (membershipRow?.organizations ?? null);

  const roleValue = membershipRowV2
    ? Array.isArray(membershipRowV2.roles)
      ? (membershipRowV2.roles[0]?.code ?? null)
      : (membershipRowV2.roles?.code ?? null)
    : membershipRowLegacy?.role;

  const role = normalizeAppRole(roleValue);

  const membership: OrganizationMembership | null =
    membershipRow && organization && role
      ? {
          id: membershipRow.id,
          organization_id: membershipRow.organization_id,
          user_id: membershipRow.user_id,
          role,
          is_active: membershipRow.is_active,
          created_at: membershipRow.created_at,
          updated_at: membershipRow.updated_at,
          organization,
        }
      : null;

  logAuthDiagnostic("profile_loaded_non_admin", {
    hasUser: true,
    profileFound: true,
    isSystemAdmin: false,
    membershipFound: Boolean(membership),
  });

  return {
    user,
    profile: profileWithSystemAdmin,
    membership,
    organization,
  };
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