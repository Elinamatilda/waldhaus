import "server-only";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { forbidden, unauthorized } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, Profile } from "./types";

type AuthContext = {
  user: User;
  profile: Profile;
};

const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error("Failed to load the current user.");
  }

  if (!user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error("Failed to load the current profile.");
  }

  if (!profile) {
    return null;
  }

  return {
    user,
    profile: profile as Profile,
  };
});

export async function getCurrentUser() {
  return (await getAuthContext())?.user ?? null;
}

export async function getCurrentProfile() {
  return (await getAuthContext())?.profile ?? null;
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

export async function requireRole(...roles: AppRole[]) {
  const context = await requireProfile();

  if (!roles.includes(context.profile.role)) {
    forbidden();
  }

  return context;
}