"use server";

import { cookies } from "next/headers";
import { forbidden, redirect, RedirectType } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { SELECTED_ORGANIZATION_COOKIE } from "@/lib/organization-context";

// Only known collection/overview routes survive a tenant change. Discard all
// entity query/hash state and return detail pages to their collection.
// Dashboard/customer analysis retain only validated, tenant-independent filters.
function organizationReturnPath(value: FormDataEntryValue | null) {
  const path = String(value ?? "").split(/[?#]/, 1)[0];
  const routes = ["/budget", "/budget/annual", "/budget/cash-flow", "/budget/liquidity", "/budget/sales", "/dashboard", "/sales", "/sales/customers", "/sales/products",
    "/sales/planning", "/sales/actuals", "/inventory", "/orders",
    "/production", "/purchasing", "/reports", "/settings"];
  const customerAnalysis = path === '/sales/customers' || /^\/sales\/customers\/[a-zA-Z0-9-]+$/.test(path);
  if (path === '/dashboard' || customerAnalysis) {
    const query = new URLSearchParams(String(value).split('?')[1]?.split('#')[0]);
    const safe = new URLSearchParams();
    const years = query.getAll('year');
    if (years.length === 1 && /^\d{4}$/.test(years[0]) && Number(years[0]) >= 2020 && Number(years[0]) <= 2100) safe.set('year', years[0]);
    const scenarios = query.getAll('scenario');
    if (customerAnalysis && scenarios.length === 1 && ['BUDGET', 'FORECAST', 'ACTUAL'].includes(scenarios[0])) safe.set('scenario', scenarios[0]);
    const destination = customerAnalysis ? '/sales/customers' : path;
    return safe.size ? `${destination}?${safe}` : destination;
  }
  if (routes.includes(path)) return path;
  if (/^\/sales\/customers\/[a-zA-Z0-9-]+$/.test(path)) return "/sales/customers";
  if (/^\/sales\/products\/[a-zA-Z0-9-]+$/.test(path)) return "/sales/products";
  return "/dashboard";
}

export async function selectOrganizationAction(formData: FormData) {
  const context = await requireProfile();
  const redirectTo = organizationReturnPath(formData.get("redirect_to"));
  const organizationId = String(formData.get("organization_id") ?? "").trim();

  if (!context.profile.is_system_admin) {
    forbidden();
  }

  if (!organizationId) {
    const cookieStore = await cookies();
    cookieStore.delete(SELECTED_ORGANIZATION_COOKIE);
    revalidatePath("/", "layout");
    redirect(redirectTo, RedirectType.replace);
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organizationId)) {
    throw new Error("Invalid organization ID.");
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
  cookieStore.set(SELECTED_ORGANIZATION_COOKIE, data.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  revalidatePath("/", "layout");
  redirect(redirectTo, RedirectType.replace);
}
