"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { SELECTED_ORGANIZATION_COOKIE } from "@/lib/organization-context";

export async function selectOrganizationAction(formData: FormData) {
  const context = await requireProfile();
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard").trim() || "/dashboard";
  const organizationId = String(formData.get("organization_id") ?? "").trim();

  if (!context.profile.is_system_admin) {
    redirect(redirectTo);
  }

  if (!organizationId) {
    const cookieStore = await cookies();
    cookieStore.delete(SELECTED_ORGANIZATION_COOKIE);
    redirect(redirectTo);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate selected organization: ${error.message}`);
  }

  if (!data) {
    throw new Error("Selected organization is not accessible.");
  }

  const cookieStore = await cookies();
  cookieStore.set(SELECTED_ORGANIZATION_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  redirect(redirectTo);
}