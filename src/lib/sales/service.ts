import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { validateYear, numericOrEmpty } from "./validation";
import { isSalesSchemaMissing } from "./errors";

export type SalesSchemaState =
  | { ready: true }
  | { ready: false; message: string };

export type ScenarioCode = "BUDGET" | "FORECAST" | "ACTUAL";

type SalesFactRow = {
  id: string;
  period_id: string;
  quantity_value: number | null;
  quantity_unit_code: string | null;
  volume_m3: number | null;
  unit_price_amount: number | null;
  pricing_basis_code: string | null;
  revenue_amount: number;
  currency_code: string;
  edit_version: string;
  revenue_mode: string;
};

function toYear(value: number) {
  return validateYear(value);
}

export async function assertSalesSchemaReady(): Promise<SalesSchemaState> {
  const supabase = await createClient();
  const { error } = await supabase.from("sales_scenarios").select("id").limit(1);

  if (!error) {
    return { ready: true };
  }

  if (isSalesSchemaMissing(error)) {
    return {
      ready: false,
      message:
        "Sales schema is not available yet. Apply the sales foundation migration before using these screens.",
    };
  }

  console.error("[sales][read]", error);
    throw new Error(`Failed to verify sales schema.`);
}

export async function listScenarios(organizationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_scenarios")
    .select("id, code, name_key")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[sales][read]", error);
    throw new Error(`Failed to load scenarios.`);
  }

  return (data ?? []) as Array<{ id: string; code: string; name_key: string }>;
}

export async function getScenarioByCode(
  organizationId: string,
  code: ScenarioCode,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_scenarios")
    .select("id, code, name_key")
    .eq("organization_id", organizationId)
    .eq("code", code)
    .maybeSingle();

  if (error) {
    console.error("[sales][read]", error);
    throw new Error(`Failed to load scenario ${code}.`);
  }

  return (data as { id: string; code: string; name_key: string } | null) ?? null;
}

export async function listCustomers(organizationId: string, search?: string, page?: number): Promise<Array<{
    id: string;
    customer_code: string | null;
    name: string;
    is_active: boolean;
    archived_at: string | null;
    notes: string | null;
    updated_at: string;
  }>> {
  if (page === undefined) {
    const rows: Awaited<ReturnType<typeof listCustomers>> = [];
    for (let index=1; ; index++) {
      const batch = await listCustomers(organizationId,search,index);
      rows.push(...batch);
      if (batch.length < 200) return rows;
    }
  }
  if (!Number.isInteger(page) || page < 1 || page > 100000) throw new Error("Invalid list page.");
  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select("id, customer_code, name, is_active, archived_at, notes, updated_at")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true }).order("id", { ascending: true });

  if (search?.trim()) {
    const q = search.trim().replace(/[\\%_(),."]/g, " ");
    query = query.or(`name.ilike.%${q}%,customer_code.ilike.%${q}%`);
  }

  const { data, error } = await query.range((page-1)*200,page*200-1);

  if (error) {
    console.error("[sales][read]", error);
    throw new Error(`Failed to load customers.`);
  }

  return (data ?? []) as Array<{
    id: string;
    customer_code: string | null;
    name: string;
    is_active: boolean;
    archived_at: string | null;
    notes: string | null;
    updated_at: string;
  }>;
}

export async function getCustomerById(organizationId: string, customerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, customer_code, name, is_active, notes")
    .eq("organization_id", organizationId)
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    console.error("[sales][read]", error);
    throw new Error(`Failed to load customer.`);
  }

  return (data as {
    id: string;
    customer_code: string | null;
    name: string;
    is_active: boolean;
    notes: string | null;
  } | null) ?? null;
}

export async function listProducts(organizationId: string, search?: string, page?: number): Promise<Array<{
    id: string;
    product_code: string | null;
    name: string;
    is_active: boolean;
    archived_at: string | null;
    description: string | null;
    updated_at: string;
  }>> {
  if (page === undefined) {
    const rows: Awaited<ReturnType<typeof listProducts>> = [];
    for (let index=1; ; index++) {
      const batch = await listProducts(organizationId,search,index);
      rows.push(...batch);
      if (batch.length < 200) return rows;
    }
  }
  if (!Number.isInteger(page) || page < 1 || page > 100000) throw new Error("Invalid list page.");
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("id, product_code, name, is_active, archived_at, description, updated_at")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true }).order("id", { ascending: true });

  if (search?.trim()) {
    const q = search.trim().replace(/[\\%_(),."]/g, " ");
    query = query.or(`name.ilike.%${q}%,product_code.ilike.%${q}%`);
  }

  const { data, error } = await query.range((page-1)*200,page*200-1);

  if (error) {
    console.error("[sales][read]", error);
    throw new Error(`Failed to load products.`);
  }

  return (data ?? []) as Array<{
    id: string;
    product_code: string | null;
    name: string;
    is_active: boolean;
    archived_at: string | null;
    description: string | null;
    updated_at: string;
  }>;
}

export async function getProductById(organizationId: string, productId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, product_code, name, is_active, description")
    .eq("organization_id", organizationId)
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    console.error("[sales][read]", error);
    throw new Error(`Failed to load product.`);
  }

  return (data as {
    id: string;
    product_code: string | null;
    name: string;
    is_active: boolean;
    description: string | null;
  } | null) ?? null;
}

export async function listVariants(organizationId: string, productId?: string, page = 1) {
  const supabase = await createClient();
  let query = supabase
    .from("product_variants")
    .select(
      "id, product_id, variant_code, variant_name, quality_code, quality_label_raw, thickness_mm, width_mm, depth_mm, length_mm, volume_per_unit_m3, default_quantity_unit_code, is_active, archived_at",
    )
    .eq("organization_id", organizationId)
    .order("variant_name", { ascending: true }).order("id", { ascending: true });

  if (productId) {
    query = query.eq("product_id", productId);
  }

  const { data, error } = await query.range((page-1)*200,page*200-1);

  if (error) {
    console.error("[sales][read]", error);
    throw new Error(`Failed to load variants.`);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    product_id: string;
    variant_code: string | null;
    variant_name: string | null;
    quality_code: string | null;
    quality_label_raw: string | null;
    thickness_mm: number | null;
    width_mm: number | null;
    depth_mm: number | null;
    length_mm: number | null;
    volume_per_unit_m3: number | null;
    default_quantity_unit_code: string | null;
    is_active: boolean;
    archived_at: string | null;
  }>;
  if (rows.length === 200) rows.push(...await listVariants(organizationId, productId, page+1));
  return rows;
}

export async function listPeriods(organizationId: string, yearInput: number) {
  const year = toYear(yearInput);
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("sales_periods")
    .select("id, period_start, month_number")
    .eq("organization_id", organizationId)
    .eq("year_number", year)
    .order("month_number", { ascending: true });

  if (existingError) {
    console.error("[sales][read]", existingError);
    throw new Error(`Failed to load periods.`);
  }

  return (existing ?? []) as Array<{ id: string; period_start: string; month_number: number }>;
}

// Explicit FK hints disambiguate the original ID links from tenant-scoped links.
// Keep the table names as response keys for the consumers below.
export async function loadPlanningGridRows(
  organizationId: string,
  args: {
    scenarioId: string;
    year: number;
    customerId?: string;
    productId?: string;
    variantId?: string | null;
  },
) {
  const periods = await listPeriods(organizationId, args.year);
  const periodIds = periods.map((p) => p.id);

  const supabase = await createClient();
  let query = supabase
    .from("sales_facts")
    .select(
      "id, edit_version, revenue_mode, period_id, customer_id, product_id, product_variant_id, quantity_value, quantity_unit_code, volume_m3, unit_price_amount, pricing_basis_code, revenue_amount, currency_code, sales_periods!sales_facts_same_org_period_fk(month_number)",
    )
    .eq("organization_id", organizationId)
    .eq("scenario_id", args.scenarioId)
    .in("period_id", periodIds);

  if (args.customerId) {
    query = query.eq("customer_id", args.customerId);
  }

  if (args.productId) {
    query = query.eq("product_id", args.productId);
  }

  if (args.variantId != null) {
    if (args.variantId === "") {
      query = query.is("product_variant_id", null);
    } else {
      query = query.eq("product_variant_id", args.variantId);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("[sales][read]", error);
    throw new Error(`Failed to load planning rows.`);
  }

  return (data ?? []).map((row) => {
    const periodRef = row.sales_periods as
      | { month_number?: number }
      | Array<{ month_number?: number }>
      | null;

    const monthNumber = Array.isArray(periodRef)
      ? periodRef[0]?.month_number
      : periodRef?.month_number;

    return {
      ...(row as SalesFactRow & {
        customer_id: string;
        product_id: string;
        product_variant_id: string | null;
      }),
      sales_periods:
        typeof monthNumber === "number"
          ? { month_number: monthNumber }
          : null,
    };
  });
}

export type SalesReport = {
  totals: Array<{scenario:string;currency_code:string;revenue:number;volume:number}>;
  months: Array<{scenario:string;currency_code:string;month_number:number;revenue:number}>;
  prices: Array<{scenario:string;currency_code:string;pricing_basis_code:string;price:number|null}>;
  customers: Array<{scenario:string;currency_code:string;customer_id:string;customer_name:string;revenue:number}>;
  products: Array<{scenario:string;currency_code:string;product_id:string;product_name:string;revenue:number}>;
};
export async function getSalesReport(organizationId:string, year:number, customerId:string|null=null, productId:string|null=null): Promise<SalesReport> {
  validateYear(year);
  const supabase = await createClient();
  const {data,error} = await supabase.rpc("sales_report", {p_organization:organizationId,p_year:year,p_customer:customerId,p_product:productId});
  if (error) {
    console.error("[sales][report]",error);
    throw new Error("Sales reporting is unavailable. Verify that the reviewed Phase 2 migration has been deployed.");
  }
  return data as SalesReport;
}
export const getOverviewData = getSalesReport;
export async function getCustomerSalesAnalytics(organizationId:string, customerId:string, year:number = new Date().getFullYear()) {
  return getSalesReport(organizationId,year,customerId);
}
export async function getProductSalesAnalytics(organizationId:string, productId:string, year:number = new Date().getFullYear()) {
  return getSalesReport(organizationId,year,null,productId);
}

export const parseNumeric = numericOrEmpty;

export function extractPostgrestMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Unknown error";
  }

  const pgError = error as PostgrestError;
  return pgError.message ?? "Unknown error";
}
