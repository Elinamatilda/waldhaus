import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
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
};

function toYear(value: number) {
  return Number.isInteger(value) ? value : new Date().getFullYear();
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

  throw new Error(`Failed to verify sales schema: ${error.message}`);
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
    throw new Error(`Failed to load scenarios: ${error.message}`);
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
    throw new Error(`Failed to load scenario ${code}: ${error.message}`);
  }

  return (data as { id: string; code: string; name_key: string } | null) ?? null;
}

export async function listCustomers(organizationId: string, search?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select("id, customer_code, name, is_active, archived_at, notes, updated_at")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  if (search?.trim()) {
    const q = search.trim();
    query = query.or(`name.ilike.%${q}%,customer_code.ilike.%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load customers: ${error.message}`);
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
    throw new Error(`Failed to load customer: ${error.message}`);
  }

  return (data as {
    id: string;
    customer_code: string | null;
    name: string;
    is_active: boolean;
    notes: string | null;
  } | null) ?? null;
}

export async function listProducts(organizationId: string, search?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("id, product_code, name, is_active, archived_at, description, updated_at")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  if (search?.trim()) {
    const q = search.trim();
    query = query.or(`name.ilike.%${q}%,product_code.ilike.%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load products: ${error.message}`);
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
    throw new Error(`Failed to load product: ${error.message}`);
  }

  return (data as {
    id: string;
    product_code: string | null;
    name: string;
    is_active: boolean;
    description: string | null;
  } | null) ?? null;
}

export async function listVariants(organizationId: string, productId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("product_variants")
    .select(
      "id, product_id, customer_id, variant_code, variant_name, quality_code, quality_label_raw, thickness_mm, width_mm, depth_mm, length_mm, volume_per_unit_m3, default_quantity_unit_code, is_active, archived_at",
    )
    .eq("organization_id", organizationId)
    .order("variant_name", { ascending: true });

  if (productId) {
    query = query.eq("product_id", productId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load variants: ${error.message}`);
  }

  return (data ?? []) as Array<{
    id: string;
    product_id: string;
    customer_id: string | null;
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
}

export async function ensurePeriods(organizationId: string, yearInput: number) {
  const year = toYear(yearInput);
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("sales_periods")
    .select("id, period_start, month_number")
    .eq("organization_id", organizationId)
    .eq("year_number", year)
    .order("month_number", { ascending: true });

  if (existingError) {
    throw new Error(`Failed to load periods: ${existingError.message}`);
  }

  const byMonth = new Map<number, { id: string; period_start: string; month_number: number }>();
  for (const row of existing ?? []) {
    byMonth.set(row.month_number as number, row as { id: string; period_start: string; month_number: number });
  }

  const missingRows: Array<{
    organization_id: string;
    period_start: string;
    year_number: number;
    month_number: number;
  }> = [];

  for (let month = 1; month <= 12; month += 1) {
    if (!byMonth.has(month)) {
      const padded = String(month).padStart(2, "0");
      missingRows.push({
        organization_id: organizationId,
        period_start: `${year}-${padded}-01`,
        year_number: year,
        month_number: month,
      });
    }
  }

  if (missingRows.length > 0) {
    const { error: insertError } = await supabase
      .from("sales_periods")
      .insert(missingRows);

    if (insertError) {
      throw new Error(`Failed to create periods: ${insertError.message}`);
    }
  }

  const { data: allRows, error: allRowsError } = await supabase
    .from("sales_periods")
    .select("id, period_start, month_number")
    .eq("organization_id", organizationId)
    .eq("year_number", year)
    .order("month_number", { ascending: true });

  if (allRowsError) {
    throw new Error(`Failed to reload periods: ${allRowsError.message}`);
  }

  return (allRows ?? []) as Array<{ id: string; period_start: string; month_number: number }>;
}

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
  const periods = await ensurePeriods(organizationId, args.year);
  const periodIds = periods.map((p) => p.id);

  const supabase = await createClient();
  let query = supabase
    .from("sales_facts")
    .select(
      "id, period_id, customer_id, product_id, product_variant_id, quantity_value, quantity_unit_code, volume_m3, unit_price_amount, pricing_basis_code, revenue_amount, currency_code, sales_periods(month_number)",
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
    throw new Error(`Failed to load planning rows: ${error.message}`);
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

export async function getOverviewData(organizationId: string, yearInput: number) {
  const year = toYear(yearInput);
  const periods = await ensurePeriods(organizationId, year);
  const periodIds = periods.map((p) => p.id);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_facts")
    .select(
      "revenue_amount, volume_m3, unit_price_amount, sales_scenarios(code), customers(name), products(name), sales_periods(month_number)",
    )
    .eq("organization_id", organizationId)
    .in("period_id", periodIds);

  if (error) {
    throw new Error(`Failed to load overview data: ${error.message}`);
  }

  const monthly = new Map<number, { BUDGET: number; FORECAST: number; ACTUAL: number }>();
  for (let month = 1; month <= 12; month += 1) {
    monthly.set(month, { BUDGET: 0, FORECAST: 0, ACTUAL: 0 });
  }

  let budgetRevenue = 0;
  let forecastRevenue = 0;
  let actualRevenue = 0;
  let annualVolume = 0;
  let volumeActual = 0;
  let priceSum = 0;
  let priceCount = 0;

  const byCustomer = new Map<string, number>();
  const byProduct = new Map<string, number>();
  const mix = new Map<string, number>();

  for (const row of data ?? []) {
    const revenue = Number(row.revenue_amount ?? 0);
    const volume = Number(row.volume_m3 ?? 0);
    const scenario = ((row.sales_scenarios as { code?: string } | null)?.code ?? "") as ScenarioCode | "";

    annualVolume += volume;
    if (scenario === "BUDGET") {
      budgetRevenue += revenue;
    }
    if (scenario === "FORECAST") {
      forecastRevenue += revenue;
    }
    if (scenario === "ACTUAL") {
      actualRevenue += revenue;
      volumeActual += volume;
    }

    const unitPrice = row.unit_price_amount == null ? null : Number(row.unit_price_amount);
    if (unitPrice != null) {
      priceSum += unitPrice;
      priceCount += 1;
    }

    const customer = (row.customers as { name?: string } | null)?.name ?? "Unknown";
    const product = (row.products as { name?: string } | null)?.name ?? "Unknown";

    byCustomer.set(customer, (byCustomer.get(customer) ?? 0) + revenue);
    byProduct.set(product, (byProduct.get(product) ?? 0) + revenue);
    mix.set(`${customer}::${product}`, (mix.get(`${customer}::${product}`) ?? 0) + revenue);

    const month = (row.sales_periods as { month_number?: number } | null)?.month_number;
    if (typeof month === "number" && monthly.has(month) && (scenario === "BUDGET" || scenario === "FORECAST" || scenario === "ACTUAL")) {
      const series = monthly.get(month)!;
      series[scenario] += revenue;
    }
  }

  const monthlyTrend = periods.map((period) => {
    const series = monthly.get(period.month_number) ?? { BUDGET: 0, FORECAST: 0, ACTUAL: 0 };
    return {
      month: period.month_number,
      budget: series.BUDGET,
      forecast: series.FORECAST,
      actual: series.ACTUAL,
    };
  });

  const topCustomers = [...byCustomer.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, revenue]) => ({ name, revenue }));

  const topProducts = [...byProduct.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, revenue]) => ({ name, revenue }));

  const customerProductMix = [...mix.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key, revenue]) => {
      const [customer, product] = key.split("::");
      return { customer, product, revenue };
    });

  return {
    budgetRevenue,
    forecastRevenue,
    actualRevenue,
    annualVolume,
    volumeActual,
    avgUnitPrice: priceCount > 0 ? priceSum / priceCount : null,
    monthlyTrend,
    topCustomers,
    topProducts,
    customerProductMix,
  };
}

export async function getCustomerSalesAnalytics(
  organizationId: string,
  customerId: string,
  yearInput?: number,
) {
  const year = yearInput ? toYear(yearInput) : null;
  const periods = year ? await ensurePeriods(organizationId, year) : null;

  const supabase = await createClient();
  let query = supabase
    .from("sales_facts")
    .select(
      "revenue_amount, volume_m3, unit_price_amount, products(name), sales_scenarios(code), sales_periods(month_number, year_number)",
    )
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId);

  if (periods) {
    query = query.in("period_id", periods.map((period) => period.id));
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load customer analytics: ${error.message}`);
  }

  let totalRevenue = 0;
  let totalVolume = 0;
  let priceSum = 0;
  let priceCount = 0;

  const byProduct = new Map<string, number>();
  const byScenario = new Map<string, number>();
  const monthly = new Map<number, { BUDGET: number; FORECAST: number; ACTUAL: number }>();

  for (let month = 1; month <= 12; month += 1) {
    monthly.set(month, { BUDGET: 0, FORECAST: 0, ACTUAL: 0 });
  }

  for (const row of data ?? []) {
    const revenue = Number(row.revenue_amount ?? 0);
    const volume = Number(row.volume_m3 ?? 0);
    totalRevenue += revenue;
    totalVolume += volume;

    const unitPrice = row.unit_price_amount == null ? null : Number(row.unit_price_amount);
    if (unitPrice != null) {
      priceSum += unitPrice;
      priceCount += 1;
    }

    const scenario = ((row.sales_scenarios as { code?: string } | null)?.code ?? "") as ScenarioCode | "";
    if (scenario) {
      byScenario.set(scenario, (byScenario.get(scenario) ?? 0) + revenue);
    }

    const product = (row.products as { name?: string } | null)?.name ?? "Unknown";
    byProduct.set(product, (byProduct.get(product) ?? 0) + revenue);

    const month = (row.sales_periods as { month_number?: number } | null)?.month_number;
    if (typeof month === "number" && monthly.has(month) && (scenario === "BUDGET" || scenario === "FORECAST" || scenario === "ACTUAL")) {
      monthly.get(month)![scenario] += revenue;
    }
  }

  const trend = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const series = monthly.get(month) ?? { BUDGET: 0, FORECAST: 0, ACTUAL: 0 };
    return {
      month,
      budget: series.BUDGET,
      forecast: series.FORECAST,
      actual: series.ACTUAL,
    };
  });

  const products = [...byProduct.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, revenue]) => ({ name, revenue }));

  return {
    totalRevenue,
    totalVolume,
    avgUnitPrice: priceCount > 0 ? priceSum / priceCount : null,
    byScenario: Object.fromEntries(byScenario.entries()),
    trend,
    products,
  };
}

export async function getProductSalesAnalytics(
  organizationId: string,
  productId: string,
  yearInput?: number,
) {
  const year = yearInput ? toYear(yearInput) : null;
  const periods = year ? await ensurePeriods(organizationId, year) : null;

  const supabase = await createClient();
  let query = supabase
    .from("sales_facts")
    .select(
      "revenue_amount, volume_m3, unit_price_amount, customers(name), sales_scenarios(code), sales_periods(month_number, year_number)",
    )
    .eq("organization_id", organizationId)
    .eq("product_id", productId);

  if (periods) {
    query = query.in("period_id", periods.map((period) => period.id));
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load product analytics: ${error.message}`);
  }

  let totalRevenue = 0;
  let totalVolume = 0;
  let priceSum = 0;
  let priceCount = 0;

  const byCustomer = new Map<string, number>();
  const byScenario = new Map<string, number>();
  const monthly = new Map<number, { BUDGET: number; FORECAST: number; ACTUAL: number }>();

  for (let month = 1; month <= 12; month += 1) {
    monthly.set(month, { BUDGET: 0, FORECAST: 0, ACTUAL: 0 });
  }

  for (const row of data ?? []) {
    const revenue = Number(row.revenue_amount ?? 0);
    const volume = Number(row.volume_m3 ?? 0);
    totalRevenue += revenue;
    totalVolume += volume;

    const unitPrice = row.unit_price_amount == null ? null : Number(row.unit_price_amount);
    if (unitPrice != null) {
      priceSum += unitPrice;
      priceCount += 1;
    }

    const scenario = ((row.sales_scenarios as { code?: string } | null)?.code ?? "") as ScenarioCode | "";
    if (scenario) {
      byScenario.set(scenario, (byScenario.get(scenario) ?? 0) + revenue);
    }

    const customer = (row.customers as { name?: string } | null)?.name ?? "Unknown";
    byCustomer.set(customer, (byCustomer.get(customer) ?? 0) + revenue);

    const month = (row.sales_periods as { month_number?: number } | null)?.month_number;
    if (typeof month === "number" && monthly.has(month) && (scenario === "BUDGET" || scenario === "FORECAST" || scenario === "ACTUAL")) {
      monthly.get(month)![scenario] += revenue;
    }
  }

  const trend = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const series = monthly.get(month) ?? { BUDGET: 0, FORECAST: 0, ACTUAL: 0 };
    return {
      month,
      budget: series.BUDGET,
      forecast: series.FORECAST,
      actual: series.ACTUAL,
    };
  });

  const customers = [...byCustomer.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, revenue]) => ({ name, revenue }));

  return {
    totalRevenue,
    totalVolume,
    avgUnitPrice: priceCount > 0 ? priceSum / priceCount : null,
    byScenario: Object.fromEntries(byScenario.entries()),
    trend,
    customers,
  };
}

export function parseNumeric(value: FormDataEntryValue | null) {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function extractPostgrestMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Unknown error";
  }

  const pgError = error as PostgrestError;
  return pgError.message ?? "Unknown error";
}
