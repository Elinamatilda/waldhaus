"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ensurePeriods, getScenarioByCode, parseNumeric } from "@/lib/sales/service";

async function resolveWritableOrganization(formData: FormData) {
  const context = await requireRole("admin");
  const fromForm = String(formData.get("organization_id") ?? "").trim();

  if (context.profile.is_system_admin) {
    if (!fromForm) {
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

function validCurrencyCode(code: string) {
  return /^[A-Z]{3}$/.test(code);
}

function validPricingBasis(code: string | null) {
  return code == null || code === "PER_PIECE" || code === "PER_M3";
}

function resolveRevenue(args: {
  revenueValue: number | null;
  quantityValue: number | null;
  volumeValue: number | null;
  unitPriceValue: number | null;
  pricingBasisCode: string | null;
}) {
  if (args.revenueValue != null) {
    return args.revenueValue;
  }

  if (args.unitPriceValue == null || !args.pricingBasisCode) {
    return null;
  }

  if (args.pricingBasisCode === "PER_PIECE" && args.quantityValue != null) {
    return Number((args.quantityValue * args.unitPriceValue).toFixed(2));
  }

  if (args.pricingBasisCode === "PER_M3" && args.volumeValue != null) {
    return Number((args.volumeValue * args.unitPriceValue).toFixed(2));
  }

  return null;
}

export async function createCustomerAction(formData: FormData) {
  const { organizationId, userId } = await resolveWritableOrganization(formData);
  const name = String(formData.get("name") ?? "").trim();
  const customerCodeRaw = String(formData.get("customer_code") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();

  if (!name) {
    throw new Error("Customer name is required.");
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
    throw new Error(error.message);
  }

  revalidatePath("/sales/customers");
  revalidatePath("/sales");
}

export async function updateCustomerAction(formData: FormData) {
  const { organizationId, userId } = await resolveWritableOrganization(formData);
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const customerCodeRaw = String(formData.get("customer_code") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();
  const isActive = String(formData.get("is_active") ?? "true").trim() !== "false";

  if (!customerId || !name) {
    throw new Error("Customer id and name are required.");
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
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/sales/customers");
  revalidatePath(`/sales/customers/${customerId}`);
  revalidatePath("/sales");
}

export async function toggleCustomerActiveAction(formData: FormData) {
  const { organizationId, userId } = await resolveWritableOrganization(formData);
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const nextState = String(formData.get("next_state") ?? "").trim() === "active";

  if (!customerId) {
    return;
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
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/sales/customers");
  revalidatePath(`/sales/customers/${customerId}`);
  revalidatePath("/sales");
}

export async function createProductAction(formData: FormData) {
  const { organizationId, userId } = await resolveWritableOrganization(formData);
  const name = String(formData.get("name") ?? "").trim();
  const productCodeRaw = String(formData.get("product_code") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();

  if (!name) {
    throw new Error("Product name is required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("products").insert({
    organization_id: organizationId,
    name,
    product_code: productCodeRaw || null,
    description: descriptionRaw || null,
    created_by: userId,
    updated_by: userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/sales/products");
  revalidatePath("/sales");
}

export async function updateProductAction(formData: FormData) {
  const { organizationId, userId } = await resolveWritableOrganization(formData);
  const productId = String(formData.get("product_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const productCodeRaw = String(formData.get("product_code") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const isActive = String(formData.get("is_active") ?? "true").trim() !== "false";

  if (!productId || !name) {
    throw new Error("Product id and name are required.");
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
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/sales/products");
  revalidatePath(`/sales/products/${productId}`);
  revalidatePath("/sales");
}

export async function toggleProductActiveAction(formData: FormData) {
  const { organizationId, userId } = await resolveWritableOrganization(formData);
  const productId = String(formData.get("product_id") ?? "").trim();
  const nextState = String(formData.get("next_state") ?? "").trim() === "active";

  if (!productId) {
    return;
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
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/sales/products");
  revalidatePath(`/sales/products/${productId}`);
  revalidatePath("/sales");
}

export async function createVariantAction(formData: FormData) {
  const { organizationId, userId } = await resolveWritableOrganization(formData);
  const productId = String(formData.get("product_id") ?? "").trim();
  const variantName = String(formData.get("variant_name") ?? "").trim();

  if (!productId) {
    throw new Error("Product is required.");
  }

  if (!variantName) {
    throw new Error("Variant name is required.");
  }

  const customerIdRaw = String(formData.get("customer_id") ?? "").trim();
  const variantCodeRaw = String(formData.get("variant_code") ?? "").trim();
  const qualityCodeRaw = String(formData.get("quality_code") ?? "").trim();
  const defaultUnitRaw = String(formData.get("default_quantity_unit_code") ?? "PIECE").trim();

  const thicknessMm = parseNumeric(formData.get("thickness_mm"));
  const widthMm = parseNumeric(formData.get("width_mm"));
  const depthMm = parseNumeric(formData.get("depth_mm"));
  const lengthMm = parseNumeric(formData.get("length_mm"));
  const volumePerUnit = parseNumeric(formData.get("volume_per_unit_m3"));

  if (defaultUnitRaw !== "PIECE" && defaultUnitRaw !== "LINEAR_METER") {
    throw new Error("Invalid default quantity unit.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("product_variants").insert({
    organization_id: organizationId,
    product_id: productId,
    customer_id: customerIdRaw || null,
    variant_code: variantCodeRaw || null,
    variant_name: variantName,
    quality_code: qualityCodeRaw || null,
    quality_label_raw: qualityCodeRaw || null,
    thickness_mm: thicknessMm,
    width_mm: widthMm,
    depth_mm: depthMm,
    length_mm: lengthMm,
    volume_per_unit_m3: volumePerUnit,
    default_quantity_unit_code: defaultUnitRaw,
    created_by: userId,
    updated_by: userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/sales/products");
  revalidatePath(`/sales/products/${productId}`);
  revalidatePath("/sales/planning");
}

async function upsertMonthlyFacts(args: {
  formData: FormData;
  scenarioId: string;
  organizationId: string;
  userId: string;
  year: number;
  customerId: string;
  productId: string;
  variantId: string | null;
}) {
  const periods = await ensurePeriods(args.organizationId, args.year);
  const supabase = await createClient();

  for (const period of periods) {
    const month = period.month_number;
    const quantityValue = parseNumeric(args.formData.get(`quantity_${month}`));
    const volumeValue = parseNumeric(args.formData.get(`volume_${month}`));
    const unitPriceValue = parseNumeric(args.formData.get(`unit_price_${month}`));
    const revenueValue = parseNumeric(args.formData.get(`revenue_${month}`));
    const quantityUnit = String(args.formData.get(`quantity_unit_${month}`) ?? "").trim();
    const pricingBasis = String(args.formData.get(`pricing_basis_${month}`) ?? "").trim() || null;
    const currencyCode =
      String(args.formData.get(`currency_${month}`) ?? "EUR").trim().toUpperCase() || "EUR";

    if (!validCurrencyCode(currencyCode)) {
      throw new Error(`Invalid currency code for month ${month}. Use ISO-4217 code.`);
    }

    if (!validPricingBasis(pricingBasis)) {
      throw new Error(`Invalid pricing basis for month ${month}.`);
    }

    if (quantityUnit && quantityUnit !== "PIECE" && quantityUnit !== "LINEAR_METER") {
      throw new Error(`Invalid quantity unit for month ${month}.`);
    }

    const resolvedRevenue = resolveRevenue({
      revenueValue,
      quantityValue,
      volumeValue,
      unitPriceValue,
      pricingBasisCode: pricingBasis,
    });

    const hasAnyInput =
      quantityValue != null ||
      volumeValue != null ||
      unitPriceValue != null ||
      revenueValue != null ||
      Boolean(pricingBasis);

    let existingQuery = supabase
      .from("sales_facts")
      .select("id")
      .eq("organization_id", args.organizationId)
      .eq("scenario_id", args.scenarioId)
      .eq("period_id", period.id)
      .eq("customer_id", args.customerId)
      .eq("product_id", args.productId)
      .limit(1);

    existingQuery = args.variantId
      ? existingQuery.eq("product_variant_id", args.variantId)
      : existingQuery.is("product_variant_id", null);

    const { data: existingRows, error: existingError } = await existingQuery;

    if (existingError) {
      throw new Error(existingError.message);
    }

    const existing = existingRows?.[0] as { id: string } | undefined;

    if (!hasAnyInput || resolvedRevenue == null) {
      if (existing) {
        const { error: deleteError } = await supabase
          .from("sales_facts")
          .delete()
          .eq("id", existing.id)
          .eq("organization_id", args.organizationId);

        if (deleteError) {
          throw new Error(deleteError.message);
        }
      }

      continue;
    }

    const payload = {
      organization_id: args.organizationId,
      scenario_id: args.scenarioId,
      period_id: period.id,
      customer_id: args.customerId,
      product_id: args.productId,
      product_variant_id: args.variantId,
      quantity_value: quantityValue,
      quantity_unit_code: quantityUnit || null,
      volume_m3: volumeValue,
      unit_price_amount: unitPriceValue,
      pricing_basis_code: pricingBasis,
      revenue_amount: resolvedRevenue,
      currency_code: currencyCode,
      updated_by: args.userId,
    };

    if (existing) {
      const { error: updateError } = await supabase
        .from("sales_facts")
        .update(payload)
        .eq("id", existing.id)
        .eq("organization_id", args.organizationId);

      if (updateError) {
        throw new Error(updateError.message);
      }
    } else {
      const { error: insertError } = await supabase
        .from("sales_facts")
        .insert({
          ...payload,
          created_by: args.userId,
        });

      if (insertError) {
        throw new Error(insertError.message);
      }
    }
  }
}

export async function upsertPlanningGridAction(formData: FormData) {
  const { organizationId, userId } = await resolveWritableOrganization(formData);

  const scenarioId = String(formData.get("scenario_id") ?? "").trim();
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const productId = String(formData.get("product_id") ?? "").trim();
  const variantIdRaw = String(formData.get("product_variant_id") ?? "").trim();
  const year = Number(String(formData.get("year") ?? "").trim());

  if (!scenarioId || !customerId || !productId || !Number.isInteger(year)) {
    throw new Error("Scenario, customer, product, and year are required.");
  }

  await upsertMonthlyFacts({
    formData,
    scenarioId,
    organizationId,
    userId,
    year,
    customerId,
    productId,
    variantId: variantIdRaw || null,
  });

  revalidatePath("/sales");
  revalidatePath("/sales/planning");
  revalidatePath("/sales/actuals");
  revalidatePath("/sales/customers");
  revalidatePath("/sales/products");
}

export async function upsertActualsGridAction(formData: FormData) {
  const { organizationId, userId } = await resolveWritableOrganization(formData);
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const productId = String(formData.get("product_id") ?? "").trim();
  const variantIdRaw = String(formData.get("product_variant_id") ?? "").trim();
  const year = Number(String(formData.get("year") ?? "").trim());

  if (!customerId || !productId || !Number.isInteger(year)) {
    throw new Error("Customer, product, and year are required.");
  }

  const actualScenario = await getScenarioByCode(organizationId, "ACTUAL");
  if (!actualScenario) {
    throw new Error("ACTUAL scenario is missing for selected organization.");
  }

  await upsertMonthlyFacts({
    formData,
    scenarioId: actualScenario.id,
    organizationId,
    userId,
    year,
    customerId,
    productId,
    variantId: variantIdRaw || null,
  });

  revalidatePath("/sales");
  revalidatePath("/sales/actuals");
  revalidatePath("/sales/customers");
  revalidatePath("/sales/products");
}
