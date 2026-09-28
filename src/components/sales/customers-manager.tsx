"use client";

import { SalesMutationForm } from "./mutation-form";
import { useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  SearchInput,
  Dialog,
  FormField,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
  Textarea,
} from "@/components/ui";
import { createCustomerAction, toggleCustomerActiveAction, updateCustomerAction } from "@/app/(authenticated)/sales/actions";
import type { AppLocale } from "@/lib/i18n/locale";
import { tApp } from '@/lib/i18n/app-ui';
import { customerSalesLink } from '@/lib/sales/customer-share';
import type { ScenarioCode } from '@/lib/sales/service';
import { tSales } from "@/lib/i18n/sales-ui";

type CustomerRow = {
  id: string;
  customer_code: string | null;
  name: string;
  is_active: boolean;
  notes: string | null;
};

export function CustomersManager({
  locale,
  rows,
  organizationId,
  year,
  scenario,
}: {
  locale: AppLocale;
  rows: CustomerRow[];
  organizationId: string;
  isSystemAdmin: boolean;
  year?: number;
  scenario?: ScenarioCode;
}) {
  const [search, setSearch] = useState('');
  const [archiving, setArchiving] = useState<CustomerRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FormField label={tApp(locale, 'customerAnalysis.masterSearch')} htmlFor="customer-master-search"><SearchInput id="customer-master-search" value={search} onChange={event => setSearch(event.target.value)} /></FormField>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          {tSales(locale, "sales.add")}
        </Button>
      </div>

      <Card className="min-w-0 overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <tr>
              <th className="px-4 py-3 text-left">{tSales(locale, "sales.name")}</th>
              <th className="px-4 py-3 text-left">{tSales(locale, "sales.code")}</th>
              <th className="px-4 py-3 text-left">{tSales(locale, "sales.status")}</th>
              <th className="px-4 py-3 text-left">{tSales(locale, "sales.notes")}</th>
              <th className="px-4 py-3 text-right">{tSales(locale, 'sales.actions')}</th>
            </tr>
          </TableHeader>
          <TableBody>
            {rows.filter(row => `${row.name} ${row.customer_code ?? ''}`.toLocaleLowerCase(locale).includes(search.trim().toLocaleLowerCase(locale))).map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link
                    className="rounded-sm text-primary hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring"
                    href={year ? customerSalesLink(year, row.id, scenario) : `/sales/customers/${row.id}`}
                  >
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell>{row.customer_code ?? "-"}</TableCell>
                <TableCell>
                  {row.is_active ? tSales(locale, "sales.active") : tSales(locale, "sales.archived")}
                </TableCell>
                <TableCell>{row.notes ?? "-"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setEditing(row)}>
                      {tSales(locale, 'sales.edit')}
                    </Button>
                    {row.is_active ? <Button variant="ghost" onClick={() => setArchiving(row)}>{tSales(locale, 'sales.archived')}</Button> : (                    <SalesMutationForm action={toggleCustomerActiveAction}>
                      <input type="hidden" name="organization_id" value={organizationId} />
                      <input type="hidden" name="customer_id" value={row.id} />
                      <input
                        type="hidden"
                        name="next_state"
                        value={row.is_active ? "archived" : "active"}
                      />
                      <Button type="submit" variant="ghost">
                        {row.is_active ? tSales(locale, "sales.archived") : tSales(locale, "sales.active")}
                      </Button>
                    </SalesMutationForm>)}

                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={archiving !== null} title={tSales(locale, 'sales.archived')} description={tApp(locale, 'customerAnalysis.archiveConfirm').replace('{name}', archiving?.name ?? '')} onClose={() => setArchiving(null)}>
        {archiving ? <SalesMutationForm action={toggleCustomerActiveAction} onSuccess={() => setArchiving(null)}>
          <input type="hidden" name="organization_id" value={organizationId} />
          <input type="hidden" name="customer_id" value={archiving.id} />
          <input type="hidden" name="next_state" value="archived" />
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setArchiving(null)}>{tApp(locale, 'customerAnalysis.cancel')}</Button><Button type="submit" variant="destructive">{tSales(locale, 'sales.archived')}</Button></div>
        </SalesMutationForm> : null}
      </Dialog>

      <Dialog
        open={createOpen}
        title={tSales(locale, "sales.add")}
        description={tSales(locale, "sales.customers")}
        onClose={() => setCreateOpen(false)}
      >
        <SalesMutationForm
          action={createCustomerAction}
          onSuccess={() => setCreateOpen(false)}
          className="space-y-3"
        >
          <input type="hidden" name="organization_id" value={organizationId} />
          <FormField label={tSales(locale, "sales.name")}>
            <Input name="name" required />
          </FormField>
          <FormField label={tSales(locale, "sales.code")}>
            <Input name="customer_code" />
          </FormField>
          <FormField label={tSales(locale, "sales.notes")}>
            <Textarea name="notes" rows={3} />
          </FormField>
          <div className="flex justify-end">
            <Button type="submit">{tSales(locale, "sales.save")}</Button>
          </div>
        </SalesMutationForm>
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        title={tApp(locale, 'customerAnalysis.editCustomer')}
        description={editing?.name}
        onClose={() => setEditing(null)}
      >
        {editing ? (
          <SalesMutationForm
            action={updateCustomerAction}
            onSuccess={() => setEditing(null)}
            className="space-y-3"
          >
            <input type="hidden" name="organization_id" value={organizationId} />
            <input type="hidden" name="customer_id" value={editing.id} />
            <FormField label={tSales(locale, "sales.name")}>
              <Input name="name" required defaultValue={editing.name} />
            </FormField>
            <FormField label={tSales(locale, "sales.code")}>
              <Input name="customer_code" defaultValue={editing.customer_code ?? ""} />
            </FormField>
            <FormField label={tSales(locale, "sales.notes")}>
              <Textarea name="notes" rows={3} defaultValue={editing.notes ?? ""} />
            </FormField>
            <FormField label={tSales(locale, "sales.status")}>
              <Select name="is_active" defaultValue={editing.is_active ? "true" : "false"}>
                <option value="true">{tSales(locale, "sales.active")}</option>
                <option value="false">{tSales(locale, "sales.archived")}</option>
              </Select>
            </FormField>
            <div className="flex justify-end">
              <Button type="submit">{tSales(locale, "sales.save")}</Button>
            </div>
          </SalesMutationForm>
        ) : null}
      </Dialog>
    </>
  );
}
