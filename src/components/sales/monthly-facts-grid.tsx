"use client";

import { useMemo, useState } from "react";
import type { MutationResult } from "@/lib/sales/validation";
import { Button, Checkbox, Select } from "@/components/ui";
import type { AppLocale } from "@/lib/i18n/locale";
import { salesMonthLabels, tSales } from "@/lib/i18n/sales-ui";

type GridRow = {
  id: string;
  version: string;
  revenueMode: string;
  periodId: string;
  monthNumber: number;
  quantityValue: number | null;
  quantityUnitCode: string | null;
  volumeM3: number | null;
  unitPriceAmount: number | null;
  pricingBasisCode: string | null;
  revenueAmount: number | null;
  currencyCode: string | null;
};

export function MonthlyFactsGrid({
  locale,
  action,
  organizationId,
  year,
  scenarioId,
  customerId,
  productId,
  variantId,
  rows,
}: {
  locale: AppLocale;
  action: (formData: FormData) => Promise<MutationResult>;
  organizationId: string;
  year: number;
  scenarioId?: string;
  customerId: string;
  productId: string;
  variantId: string;
  rows: GridRow[];
}) {
  const [result, setResult] = useState<MutationResult | null>(null);
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const months = salesMonthLabels(locale);

  const rowMap = useMemo(() => {
    const map = new Map<number, GridRow>();
    for (const row of rows) {
      map.set(row.monthNumber, row);
    }
    return map;
  }, [rows]);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        const formData = new FormData(event.currentTarget);
        setPending(true);
        try {
          const response = await action(formData);
          setResult(response);
          if (response.ok) setDirty(false);
        } catch { setResult({ok:false,code:"DATABASE_ERROR",message:"Save failed. Refresh to verify the current data before retrying."}); }
        finally { setPending(false); }
      }}
      onChange={() => setDirty(true)}
      className="overflow-x-auto rounded-lg border border-border bg-surface-raised p-4"
    >
      <input type="hidden" name="organization_id" value={organizationId} />
      {scenarioId ? <input type="hidden" name="scenario_id" value={scenarioId} /> : null}
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="product_variant_id" value={variantId} />
      <input type="hidden" name="year" value={String(year)} />

      <fieldset disabled={pending}>
      <table className="min-w-[1200px] w-full border-collapse text-body">
        <thead>
          <tr>
            <th className="border-b border-border px-2 py-2 text-left">{tSales(locale, "sales.month")}</th>
            <th>Delete</th><th>Revenue mode</th>
            <th className="border-b border-border px-2 py-2 text-right">{tSales(locale, "sales.quantity")}</th>
            <th className="border-b border-border px-2 py-2 text-left">Unit</th>
            <th className="border-b border-border px-2 py-2 text-right">{tSales(locale, "sales.volume")}</th>
            <th className="border-b border-border px-2 py-2 text-right">{tSales(locale, "sales.unitPrice")}</th>
            <th className="border-b border-border px-2 py-2 text-left">{tSales(locale, "sales.pricingBasis")}</th>
            <th className="border-b border-border px-2 py-2 text-right">{tSales(locale, "sales.revenue")}</th>
            <th className="border-b border-border px-2 py-2 text-left">{tSales(locale, "sales.currency")}</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 12 }, (_, index) => {
            const monthNumber = index + 1;
            const value = rowMap.get(monthNumber);
            return (
              <tr key={monthNumber}>
                <td className="border-b border-border px-2 py-2">{months[index] ?? String(monthNumber)}
                  <input type="hidden" name={`id_${monthNumber}`} value={value?.id ?? ""} />
                  <input type="hidden" name={`version_${monthNumber}`} value={value?.version ?? ""} />
                </td>
                <td><Checkbox name={`delete_${monthNumber}`} disabled={!value} aria-label={`Delete month ${monthNumber}`} /></td>
                <td><Select name={`revenue_mode_${monthNumber}`} defaultValue={value?.revenueMode ?? "CALCULATED"}>
                  <option value="CALCULATED">Calculated</option><option value="MANUAL">Manual / override</option>
                </Select></td>
                <td className="border-b border-border px-2 py-2">
                  <input
                    className="h-9 w-full rounded-lg border border-border bg-surface-raised px-3 text-right"
                    name={`quantity_${monthNumber}`}
                    defaultValue={value?.quantityValue ?? ""}
                  />
                </td>
                <td className="border-b border-border px-2 py-2">
                  <Select
                    className="h-9 w-full rounded-lg border border-border bg-surface-raised px-3"
                    name={`quantity_unit_${monthNumber}`}
                    defaultValue={value?.quantityUnitCode ?? "PIECE"}
                  >
                    <option value="PIECE">PIECE</option>
                    <option value="LINEAR_METER">LINEAR_METER</option>
                  </Select>
                </td>
                <td className="border-b border-border px-2 py-2">
                  <input
                    className="h-9 w-full rounded-lg border border-border bg-surface-raised px-3 text-right"
                    name={`volume_${monthNumber}`}
                    defaultValue={value?.volumeM3 ?? ""}
                  />
                </td>
                <td className="border-b border-border px-2 py-2">
                  <input
                    className="h-9 w-full rounded-lg border border-border bg-surface-raised px-3 text-right"
                    name={`unit_price_${monthNumber}`}
                    defaultValue={value?.unitPriceAmount ?? ""}
                  />
                </td>
                <td className="border-b border-border px-2 py-2">
                  <Select
                    className="h-9 w-full rounded-lg border border-border bg-surface-raised px-3"
                    name={`pricing_basis_${monthNumber}`}
                    defaultValue={value?.pricingBasisCode ?? ""}
                  >
                    <option value=""></option>
                    <option value="PER_PIECE">PER_PIECE</option>
                    <option value="PER_M3">PER_M3</option>
                  </Select>
                </td>
                <td className="border-b border-border px-2 py-2">
                  <input
                    className="h-9 w-full rounded-lg border border-border bg-surface-raised px-3 text-right"
                    name={`revenue_${monthNumber}`}
                    defaultValue={value?.revenueAmount ?? ""}
                  />
                </td>
                <td className="border-b border-border px-2 py-2">
                  <input
                    className="h-9 w-full rounded-lg border border-border bg-surface-raised px-3"
                    name={`currency_${monthNumber}`}
                    defaultValue={value?.currencyCode ?? "EUR"}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <label><Checkbox name="confirm_delete" /> Confirm deletion of the selected months</label>
      {result && !result.ok ? <p role="alert">{result.message}</p> : null}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-body-small text-text-secondary">{dirty ? "Unsaved changes" : "All changes saved"}</p>
        <Button type="submit" loading={pending}>{tSales(locale, "sales.save")}</Button>
      </div>
      </fieldset>
    </form>
  );
}
