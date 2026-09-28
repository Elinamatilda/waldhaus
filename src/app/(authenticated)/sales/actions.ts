"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getScenarioByCode } from "@/lib/sales/service";

import { getOrganizationContext } from "@/lib/organization-context";
import { parseAnnualForm, uuid, SalesValidationError, type MutationResult } from "@/lib/sales/validation";

async function resolveWritableOrganization(formData: FormData) {
  const context = await requireRole("admin");
  const fromForm = String(formData.get("organization_id") ?? "").trim();

  if (context.profile.is_system_admin) {
    if (!fromForm || fromForm !== (await getOrganizationContext()).selectedOrganizationId) {
      throw new Error("Organization is required for system admin operations.");
    }

    return {
      organizationId: fromForm,
      userId: context.user.id,
      isSystemAdmin: true,
    };
  }

  if (!context.membership) {
    throw new Error("Missing organization membership.");
  }

  return {
    organizationId: context.membership.organization_id,
    userId: context.user.id,
    isSystemAdmin: false,
  };
}

async function createCustomer(formData: FormData) {
  const { organizationId, userId } = await resolveWritableOrganization(formData);
  const name = String(formData.get("name") ?? "").trim();
  const customerCodeRaw = String(formData.get("customer_code") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();

  if (!name) {
    throw new SalesValidationError("Customer name is required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("customers").insert({
    organization_id: organizationId,
    name,
    customer_code: customerCodeRaw || null,
    notes: notesRaw || null,
    created_by: userId,
    updated_by: userId,
  });

  if (error) {
    console.error("[sales][master-data]", error);
    throw Object.assign(new Error("Sales change failed."), { databaseCode: error.code });
  }

  revalidatePath("/sales/customers");
  revalidatePath("/sales");
}

async function updateCustomer(formData: FormData) {
  const { organizationId, userId } = await resolveWritableOrganization(formData);
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const customerCodeRaw = String(formData.get("customer_code") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();
  const isActive = String(formData.get("is_active") ?? "true").trim() !== "false";

  if (!customerId || !name) {
    throw new SalesValidationError("Customer id and name are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      name,
      customer_code: customerCodeRaw || null,
      notes: notesRaw || null,
      is_active: isActive,
      archived_at: isActive ? null : new Date().toISOString(),
      updated_by: userId,
    })
    .eq("id", customerId)
    .eq("organization_id", organizationId).select("id").single();

  if (error) {
    console.error("[sales][master-data]", error);
    throw Object.assign(new Error("Sales change failed."), { databaseCode: error.code });
  }

  revalidatePath("/sales/customers");
  revalidatePath(`/sales/customers/${customerId}`);
  revalidatePath("/sales");
}

async function toggleCustomerActive(formData: FormData) {
  const { organizationId, userId } = await resolveWritableOrganization(formData);
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const nextState = String(formData.get("next_state") ?? "").trim() === "active";

  if (!customerId) {
    throw new SalesValidationError("Record identifier is required.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      is_active: nextState,
      archived_at: nextState ? null : new Date().toISOString(),
      updated_by: userId,
    })
    .eq("id", customerId)
    .eq("organization_id", organizationId).select("id").single();

  if (error) {
    console.error("[sales][master-data]", error);
    throw Object.assign(new Error("Sales change failed."), { databaseCode: error.code });
  }

  revalidatePath("/sales/customers");
  revalidatePath(`/sales/customers/${customerId}`);
  revalidatePath("/sales");
}

async function createProduct(formData: FormData) {
  const { organizationId, userId } = await resolveWritableOrganization(formData);
  const name = String(formData.get("name") ?? "").trim();
  const productCodeRaw = String(formData.get("product_code") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();

  if (!name) {
    throw new SalesValidationError("Product name is required.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("products").insert({
    organization_id: organizationId,
    name,
    product_code: productCodeRaw || null,
    description: descriptionRaw || null,
    created_by: userId,
    updated_by: userId,
  }).select('id').single();

  if (error) {
    console.error("[sales][master-data]", error);
    throw Object.assign(new Error("Sales change failed."), { databaseCode: error.code });
  }

  revalidatePath("/sales/products");
  revalidatePath("/sales");
  return {id:data!.id as string};
}

async function updateProduct(formData: FormData) {
  const { organizationId, userId } = await resolveWritableOrganization(formData);
  const productId = String(formData.get("product_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const productCodeRaw = String(formData.get("product_code") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const isActive = String(formData.get("is_active") ?? "true").trim() !== "false";

  if (!productId || !name) {
    throw new SalesValidationError("Product id and name are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({
      name,
      product_code: productCodeRaw || null,
      description: descriptionRaw || null,
      is_active: isActive,
      archived_at: isActive ? null : new Date().toISOString(),
      updated_by: userId,
    })
    .eq("id", productId)
    .eq("organization_id", organizationId).select("id").single();

  if (error) {
    console.error("[sales][master-data]", error);
    throw Object.assign(new Error("Sales change failed."), { databaseCode: error.code });
  }

  revalidatePath("/sales/products");
  revalidatePath(`/sales/products/${productId}`);
  revalidatePath("/sales");
}

async function toggleProductActive(formData: FormData) {
  const { organizationId, userId } = await resolveWritableOrganization(formData);
  const productId = String(formData.get("product_id") ?? "").trim();
  const nextState = String(formData.get("next_state") ?? "").trim() === "active";

  if (!productId) {
    throw new SalesValidationError("Record identifier is required.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({
      is_active: nextState,
      archived_at: nextState ? null : new Date().toISOString(),
      updated_by: userId,
    })
    .eq("id", productId)
    .eq("organization_id", organizationId).select("id").single();

  if (error) {
    console.error("[sales][master-data]", error);
    throw Object.assign(new Error("Sales change failed."), { databaseCode: error.code });
  }

  revalidatePath("/sales/products");
  revalidatePath(`/sales/products/${productId}`);
  revalidatePath("/sales");
}

async function createVariant(formData: FormData) {
  const { organizationId } = await resolveWritableOrganization(formData);
  const { createProductVariant } = await import('@/lib/products/service');
  if (formData.get('customer_id') || formData.get('volume_per_unit_m3') || formData.get('depth_mm')) {
    throw new SalesValidationError('Use independent physical specification and customer commercial terms.');
  }
  const fields=['product_id','variant_code','variant_name','wood_species_id','construction_type_id','quality_code','thickness_mm','width_mm','length_mm','default_quantity_unit_code'];
  const payload=Object.fromEntries(fields.map(field=>[field,String(formData.get(field)??'').trim()||null]));
  await createProductVariant(organizationId,{...payload,is_active:true});
  revalidatePath('/sales/products','layout');revalidatePath('/budget/sales');
}

async function saveAnnual(formData: FormData, mode: "planning" | "actual"): Promise<MutationResult> {
  // Resolve verified authorization before accessing any writable data.
  try {
    const { organizationId } = await resolveWritableOrganization(formData);
    const input = parseAnnualForm(formData);
    const scenarioId = mode === "actual"
      ? (await getScenarioByCode(organizationId, "ACTUAL"))?.id
      : uuid(String(formData.get("scenario_id") ?? ""));
    if (!scenarioId) return {ok:false,code:"NOT_FOUND",message:"Sales scenario is unavailable."};
    const supabase = await createClient();
    const {error} = await supabase.rpc("save_sales_year", {
      p_organization: organizationId, p_scenario: scenarioId, p_year:input.year,
      p_customer:input.customer, p_product:input.product, p_variant:input.variant,
      p_mode:mode, p_months:input.months,
    });
    if (error) {
      console.error("[sales][save_sales_year]", error);
      const code = error.code === "40001" || error.code === "40P01" || error.code === "23505" ? "CONFLICT"
        : error.code === "42501" ? "FORBIDDEN" : error.code === "P0002" ? "NOT_FOUND"
        : error.code === "22023" || error.code.startsWith("23") ? "VALIDATION_ERROR" : "DATABASE_ERROR";
      const messages = {CONFLICT:"The data has changed since you opened it. Refresh before saving.",FORBIDDEN:"You cannot change these sales records.",NOT_FOUND:"A selected sales record no longer exists.",VALIDATION_ERROR:"Check the monthly values and selected customer, product and variant.",DATABASE_ERROR:"Sales save failed. No months were saved."};
      return {ok:false,code,message:messages[code]};
    }
    revalidatePath("/sales", "layout");
    revalidatePath("/budget/sales");
    return {ok:true};
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) return {ok:false,code:"FORBIDDEN",message:"You cannot change these sales records."};
    if (error instanceof SalesValidationError) return {ok:false,code:"VALIDATION_ERROR",message:error.message};
    console.error("[sales][annual-save]", error);
    return {ok:false,code:"DATABASE_ERROR",message:"Sales save failed. No months were saved."};
  }
}
export async function upsertPlanningGridAction(formData: FormData) { return saveAnnual(formData,"planning"); }
export async function upsertActualsGridAction(formData: FormData) { return saveAnnual(formData,"actual"); }

async function masterMutation(operation: () => Promise<void | {id:string}>): Promise<MutationResult> {
  try { const saved=await operation(); return {ok:true,...saved}; }
  catch(error) {
    // Preserve framework auth interrupts; do not downgrade failed authorization.
    if (error && typeof error === "object" && "digest" in error) return {ok:false,code:"FORBIDDEN",message:"You cannot change these sales records."};
    if (error instanceof SalesValidationError) return {ok:false,code:"VALIDATION_ERROR",message:error.message};
    const dbCode = error && typeof error === "object" && "databaseCode" in error ? String(error.databaseCode) : "";
    const code = dbCode === "23505" ? "CONFLICT" : dbCode === "42501" ? "FORBIDDEN"
      : dbCode === "P0002" || dbCode === "PGRST116" ? "NOT_FOUND" : dbCode.startsWith("23") ? "VALIDATION_ERROR" : "DATABASE_ERROR";
    console.error("[sales][master-mutation]",error);
    return {ok:false,code,message:code === "CONFLICT" ? "A record with this name or code already exists." : "The change could not be saved. Check the values and your organization access."};
  }
}
export async function createCustomerAction(formData: FormData) { return masterMutation(() => createCustomer(formData)); }
export async function updateCustomerAction(formData: FormData) { return masterMutation(() => updateCustomer(formData)); }
export async function toggleCustomerActiveAction(formData: FormData) { return masterMutation(() => toggleCustomerActive(formData)); }
export async function createProductAction(formData: FormData) { return masterMutation(() => createProduct(formData)); }
export async function updateProductAction(formData: FormData) { return masterMutation(() => updateProduct(formData)); }
export async function toggleProductActiveAction(formData: FormData) { return masterMutation(() => toggleProductActive(formData)); }
export async function createVariantAction(formData: FormData) { return masterMutation(() => createVariant(formData)); }
