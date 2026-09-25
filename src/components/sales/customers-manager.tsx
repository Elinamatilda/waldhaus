"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Button,
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
  isSystemAdmin,
}: {
  locale: AppLocale;
  rows: CustomerRow[];
  organizationId: string;
  isSystemAdmin: boolean;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);

  return (
    <>
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          {tSales(locale, "sales.add")}
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-surface-raised p-0">
        <Table>
          <TableHeader>
            <tr>
              <th className="px-4 py-3 text-left">{tSales(locale, "sales.name")}</th>
              <th className="px-4 py-3 text-left">{tSales(locale, "sales.code")}</th>
              <th className="px-4 py-3 text-left">{tSales(locale, "sales.status")}</th>
              <th className="px-4 py-3 text-left">{tSales(locale, "sales.notes")}</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link
                    className="text-primary hover:underline"
                    href={`/sales/customers/${row.id}${isSystemAdmin ? `?org=${organizationId}` : ""}`}
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
                      Edit
                    </Button>
                    <form action={toggleCustomerActiveAction}>
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
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={createOpen}
        title={tSales(locale, "sales.add")}
        description={tSales(locale, "sales.customers")}
        onClose={() => setCreateOpen(false)}
      >
        <form
          action={async (formData) => {
            await createCustomerAction(formData);
            setCreateOpen(false);
          }}
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
        </form>
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        title="Edit customer"
        description={editing?.name}
        onClose={() => setEditing(null)}
      >
        {editing ? (
          <form
            action={async (formData) => {
              await updateCustomerAction(formData);
              setEditing(null);
            }}
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
          </form>
        ) : null}
      </Dialog>
    </>
  );
}
