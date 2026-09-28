'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Checkbox, MultiCheckboxSelect, Dialog, EmptyState, FormField, Input, Select, SectionHeader, StatusBadge, Table, TableBody, TableCell, TableHeader, TableRow, Textarea } from '@/components/ui';
import { suggestVariantName } from '@/lib/products/variant-naming';
import { ProductSpeciesSelector } from './product-species-selector';
import { SalesMutationForm } from './mutation-form';
import { saveProductMasterAction } from '@/app/actions/product-master';
import { MASTER_FIELDS, PRICE_UNITS, PRODUCT_UNITS, type MasterEntity } from '@/lib/products/model';
import type { MasterRow } from '@/lib/products/service';
import type { CommercialTermDefinition, CustomerProductDefinition, ProductMasterDefinition, ProductVariantDefinition } from '@/lib/products/read-model';
import { tApp, type AppMessageKey } from '@/lib/i18n/app-ui';
import { tProduct } from '@/lib/i18n/product-master-ui';
import type { AppLocale } from '@/lib/i18n/config';
import type { MutationResult } from '@/lib/sales/validation';

type Lookups = {wood_species: MasterRow[]; construction_types: MasterRow[]};
type EditRow = Record<string, unknown> & {id: string; edit_version: string};
type Editor = {entity: MasterEntity; row: EditRow | null; parentId?: string; archive?: boolean; customerLinks?: CustomerProductDefinition[]};

// Form adapters flatten only the write fields. The canonical read model owns all joins and geometry.
const variantFields = (variant: ProductVariantDefinition): EditRow => ({...variant, ...variant.dimensions});
const decimal = (value: string | null) => value === null ? '—' : value.includes('.') ? value.replace(/0+$/, '').replace(/[.]$/, '') : value;
const dimensions = (variant: ProductVariantDefinition) => `${[variant.dimensions.thickness_mm, variant.dimensions.width_mm, variant.dimensions.length_mm].map(decimal).join(' × ')} mm`;

export function ProductMasterManager({organizationId, locale, definition, lookups, customers, variantId}: {
  organizationId: string; locale: AppLocale; definition: ProductMasterDefinition;
  lookups: Lookups; customers: {id: string; name: string; is_active: boolean}[]; variantId?: string;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [dialog, setDialog] = useState<Editor | null>(null);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [variantDraft, setVariantDraft] = useState<Record<string, string>>({});
  const label = (key: string) => tApp(locale, `productMaster.${key}` as AppMessageKey);
  const text = (key: Parameters<typeof tProduct>[1]) => tProduct(locale, key);
  const product = definition.product;
  const variant = definition.variants.find(row => row.id === variantId);
  const base = `/sales/products/${product.id}`;
  const open = (entity: MasterEntity, row: EditRow | null, parentId?: string) => {
    const customerLinks = entity === 'product_variants' ? definition.variants.find(item => item.id === row?.id)?.related.customer_products ?? [] : undefined;
    setSelectedCustomers(customerLinks?.filter(link => link.is_active).map(link => link.customer_id) ?? []);
    setVariantDraft({}); setDialog({entity, row, parentId, customerLinks});
  };
  const customerLinks = dialog?.customerLinks ?? [];
  const removedCustomers = customerLinks.filter(link => link.is_active && !selectedCustomers.includes(link.customer_id));
  const reactivatedCustomers = customerLinks.filter(link => !link.is_active && selectedCustomers.includes(link.customer_id));
  const status = (active: boolean) => <StatusBadge status={active ? 'success' : 'neutral'}>{label(active ? 'active' : 'archived')}</StatusBadge>;
  const actions = (entity: MasterEntity, row: EditRow) => <div className="flex flex-wrap gap-2">
    <Button variant="secondary" disabled={refreshing} onClick={() => open(entity, row)}>{label('edit')}</Button>
    {row.is_active ? <Button variant="ghost" disabled={refreshing} onClick={() => setDialog({entity, row, archive: true})}>{label('archive')}</Button> : null}
  </div>;
  const success = (result: Extract<MutationResult, {ok: true}>) => {
    const newVariant = dialog?.entity === 'product_variants' && !dialog.row && result.id;
    setDialog(null);
    startRefresh(() => { if (newVariant) router.push(`${base}/variants/${result.id}`); else router.refresh(); });
  };
  const options = (key: string) => {
    if (key === 'wood_species_id' || key === 'construction_type_id') {
      const rows = lookups[key === 'wood_species_id' ? 'wood_species' : 'construction_types'];
      return rows.filter(row => row.is_active || row.id === dialog?.row?.[key])
        .map(row => ({id: row.id, name: String(row[`name_${locale}`])}));
    }
    if (key === 'customer_id') return customers.filter(row => (row.is_active && !variant?.related.customer_products.some(link => link.customer_id === row.id)) || row.id === dialog?.row?.customer_id);
    if (key === 'default_quantity_unit_code' || key === 'demand_unit_code') return PRODUCT_UNITS.map(code => ({id: code, name: label(code)}));
    if (key === 'pricing_basis_code') return Object.entries(PRICE_UNITS).map(([basis, unit]) => ({id: basis, name: `/ ${label(unit)}`}));
    if (key === 'demand_period') return ['YEAR', 'MONTH'].map(id => ({id, name: label(id)}));
    return null;
  };
  const similar = dialog?.entity === 'product_variants' && !dialog.row && ['thickness_mm', 'width_mm', 'length_mm'].every(key => variantDraft[key]) && definition.variants.some(row =>
    ['thickness_mm', 'width_mm', 'length_mm'].every(key => Number(row.dimensions[key as keyof typeof row.dimensions]) === Number(variantDraft[key])) &&
    ['wood_species_id', 'construction_type_id'].every(key => (row[key as 'wood_species_id'] ?? '') === (variantDraft[key] ?? '')));
  const creatingVariant = dialog?.entity === 'product_variants' && !dialog.row && !dialog.archive;
  const namingLookup = (rows: MasterRow[], id: string) => {
    const row = rows.find(item => item.id === id);
    return row ? {code: String(row.code), name: String(row[`name_${locale}`])} : null;
  };
  const suggested = creatingVariant ? suggestVariantName(product, namingLookup(lookups.wood_species, variantDraft.wood_species_id), namingLookup(lookups.construction_types, variantDraft.construction_type_id), variantDraft) : null;
  const duplicateCode = !!suggested && definition.variants.some(row => row.variant_code === suggested.code);
  const namingBlocked = creatingVariant && (!suggested?.valid || duplicateCode);
  const termSummary = (term: CommercialTermDefinition) => <div className="space-y-2">
    <p className="text-body"><span className="text-text-secondary">{text('expectedDemand')}: </span>{term.demand_quantity === null ? '—' : `${decimal(term.demand_quantity)} ${term.demand_unit?.name ?? '—'} / ${label(term.demand_period ?? 'none')} (${term.demand_year})`}</p>
    <p className="text-body"><span className="text-text-secondary">{label('unit_price_amount')}: </span>{term.unit_price_amount === null ? '—' : `${decimal(term.unit_price_amount)} ${term.currency_code} / ${label(PRICE_UNITS[term.pricing_basis_code as keyof typeof PRICE_UNITS])}`}</p>
    <p className="text-body-small text-text-secondary">{label('valid_from')}: {term.valid_from} · {label('valid_to')}: {term.valid_to ?? '—'}</p>
    {term.delivery_note ? <p>{label('delivery_note')}: {term.delivery_note}</p> : null}
    {term.notes ? <p>{label('notes')}: {term.notes}</p> : null}
  </div>;

  return <div className="space-y-6">
    {!variant ? <>
      <Card className="space-y-4">
        <SectionHeader title={text('variants')} actions={<Button disabled={refreshing || !product.is_active} onClick={() => open('product_variants', null)}>{text('addVariant')}</Button>} />
        {!product.is_active ? <p>{text('inactiveParent')}</p> : null}
        {!definition.variants.length ? <EmptyState title={label('empty')} description={text('emptyVariants')} /> : <div className="overflow-x-auto">
          <Table><TableHeader><tr><th className="px-4 py-3 text-left">{label('variant_name')}</th><th className="px-4 py-3 text-left">{text('specification')}</th><th className="px-4 py-3 text-left">{text('customers')}</th><th className="px-4 py-3 text-left">{label('is_active')}</th><th className="px-4 py-3 text-left">{text('actions')}</th></tr></TableHeader><TableBody>
            {definition.variants.map(row => <TableRow key={row.id}>
              <TableCell><Link className="text-primary hover:underline" href={`${base}/variants/${row.id}`}>{row.variant_name ?? row.variant_code}</Link><p className="text-body-small text-text-secondary">{row.variant_code}</p></TableCell>
              <TableCell>{row.wood_species?.name ?? '—'} · {row.construction_type?.name ?? '—'}<p>{dimensions(row)}</p></TableCell>
              <TableCell>{row.related.customer_products.filter(link => link.is_active).map(link => link.customer.name).join(', ') || '—'}</TableCell>
              <TableCell>{status(row.is_active)}</TableCell><TableCell>{actions('product_variants', variantFields(row))}</TableCell>
            </TableRow>)}
          </TableBody></Table>
        </div>}
      </Card>
      <Card className="space-y-4">
        <SectionHeader title={text('lookups')} />
        <ProductSpeciesSelector organizationId={organizationId} productId={product.id} productName={product.name} productActive={product.is_active} locale={locale}
          selected={definition.offered_wood_species ?? null}
          options={lookups.wood_species.map(row => ({id: row.id, name: String(row[`name_${locale}`]), is_active: Boolean(row.is_active)}))} />
        <p className="text-body-small text-text-secondary">{text('lookupHint')}</p>
        {(['wood_species', 'construction_types'] as const).map(entity => <details key={entity}>
          <summary className="cursor-pointer text-section-title">{entity === 'wood_species' ? text('manageSpeciesCatalogue') : label(entity)} ({lookups[entity].length})</summary>
          <div className="space-y-3 py-3"><Button variant="secondary" disabled={refreshing} onClick={() => open(entity, null)}>{entity === 'wood_species' ? text('addCatalogueSpecies') : `${label('add')} · ${label(entity)}`}</Button>
            {lookups[entity].map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3"><p>{String(row[`name_${locale}`])} · {String(row.code)} {status(Boolean(row.is_active))}</p>{actions(entity, row)}</div>)}
          </div>
        </details>)}
      </Card>
    </> : <>
      <Card className="space-y-4">
        <SectionHeader title={text('general')} actions={actions('product_variants', variantFields(variant))} />
        <p>{label('variant_code')}: {variant.variant_code}</p><p>{label('variant_name')}: {variant.variant_name}</p>{status(variant.is_active)}
      </Card>
      <Card className="space-y-4">
        <SectionHeader title={text('specification')} />
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[[text('family'), product.name], [label('wood_species_id'), variant.wood_species?.name], [label('construction_type_id'), variant.construction_type?.name],
            [label('thickness_mm'), decimal(variant.dimensions.thickness_mm)], [label('width_mm'), decimal(variant.dimensions.width_mm)], [label('length_mm'), decimal(variant.dimensions.length_mm)],
            [label('quality_code'), variant.quality_code], [label('default_quantity_unit_code'), variant.default_quantity_unit?.name]].map(([name, value]) => <div key={name}><dt className="text-label text-text-secondary">{name}</dt><dd className="text-body">{value ?? '—'}</dd></div>)}
        </dl>
      </Card>
      <Card className="space-y-3"><SectionHeader title={text('calculated')} /><p>{label('theoreticalVolume')}: {variant.theoretical_volume_m3 ?? '—'}</p><p className="text-body-small text-text-secondary">{text('geometry')}</p></Card>
      <SectionHeader title={text('customers')} actions={<Button disabled={refreshing || !product.is_active || !variant.is_active} onClick={() => open('customer_products', null, variant.id)}>{text('addCustomer')}</Button>} />
      <p className="text-body-small text-text-secondary">{text('notOrders')} {text('effectiveDate')}: {definition.as_of}</p>
      {!variant.related.customer_products.length ? <EmptyState title={label('empty')} description={text('addCustomer')} /> : null}
      {variant.related.customer_products.map(link => <Card key={link.id} className="space-y-4">
        <SectionHeader title={link.customer.name} actions={actions('customer_products', link)} />
        {status(link.is_active)}
        <p>{label('customer_product_code')}: {link.customer_product_code ?? '—'}</p><p>{label('customer_product_name')}: {link.customer_product_name ?? '—'}</p>
        {link.notes ? <p>{label('notes')}: {link.notes}</p> : null}
        <SectionHeader title={text('currentTerms')} actions={<Button variant="secondary" disabled={refreshing || !product.is_active || !variant.is_active || !link.is_active || !link.customer.is_active} onClick={() => open('customer_product_terms', null, link.id)}>{text('addTerms')}</Button>} />
        {link.current_terms.length ? link.current_terms.map(term => <div key={term.id} className="space-y-3">{termSummary(term)}{actions('customer_product_terms', term)}</div>) : <p className="text-body-small text-text-secondary">{text('noCurrentTerms')}</p>}
        <details><summary className="cursor-pointer text-label">{text('history')} ({link.terms.length})</summary><div className="space-y-4 py-3">{link.terms.map(term => <Card key={term.id} className="space-y-3">{status(term.is_active)}{termSummary(term)}{actions('customer_product_terms', term)}</Card>)}</div></details>
      </Card>)}
    </>}

    <Dialog open={!!dialog} title={dialog ? label(dialog.archive ? 'archive' : dialog.entity) : ''} onClose={() => setDialog(null)} description={dialog?.archive ? label('archiveConfirm') : undefined}>
      {dialog ? <SalesMutationForm key={`${dialog.entity}:${dialog.row?.id ?? 'new'}:${dialog.archive}`} action={saveProductMasterAction} locale={locale} onSuccess={success} className="space-y-3">
        <input type="hidden" name="organization_id" value={organizationId} /><input type="hidden" name="entity" value={dialog.entity} /><input type="hidden" name="id" value={dialog.row?.id ?? ''} /><input type="hidden" name="edit_version" value={dialog.row?.edit_version ?? ''} />
        {dialog.archive ? <><input type="hidden" name="operation" value="archive" /><input type="hidden" name="confirmed" value="true" /></> : <>
          {dialog.entity === 'product_variants' ? <p className="text-body-small text-text-secondary">{text('immutable')}</p> : null}
          {dialog.entity === 'customer_product_terms' ? <p className="text-body-small text-text-secondary">{label('termsGuidance')} {text('notOrders')}</p> : null}
          {dialog.entity === 'product_variants' ? <>
            <input type="hidden" name="customer_selection_present" value="true" />
            <input type="hidden" name="expected_customer_links" value={JSON.stringify(customerLinks.map(link => ({id: link.id, edit_version: link.edit_version})))} />
            <FormField label={text('customers')} htmlFor="variant-customers" help={text('variantCustomersHint')}>
              <MultiCheckboxSelect id="variant-customers" name="customer_ids" label={text('customers')} placeholder={text('selectVariantCustomers')} emptyLabel={text('noSelectableCustomers')}
                options={customers.filter(customer => customer.is_active || customerLinks.some(link => link.customer_id === customer.id && link.is_active))
                  .map(customer => ({id: customer.id, name: customer.is_active ? customer.name : `${customer.name} · ${label('archived')}`}))}
                value={selectedCustomers} onChange={setSelectedCustomers} />
            </FormField>
            {reactivatedCustomers.length ? <p className="text-body-small text-text-secondary">{text('reactivateCustomersHint')}</p> : null}
            {removedCustomers.length ? <label className="flex items-start gap-3 text-body-small">
              <Checkbox name="confirm_customer_archive" value="true" required />
              <span>{text('confirmCustomerArchive').replace('{customers}', removedCustomers.map(link => link.customer.name).join(', '))}</span>
            </label> : null}
          </> : null}
          {Object.entries(MASTER_FIELDS[dialog.entity]).filter(([key]) => !creatingVariant || !['variant_code', 'variant_name'].includes(key)).map(([key, kind]) => {
            const parent = key === 'product_id' ? product.id : ['product_variant_id', 'customer_product_id'].includes(key) ? String(dialog.row?.[key] ?? dialog.parentId) : null;
            if (parent) return <input key={key} type="hidden" name={key} value={parent} />;
            const value = dialog.row?.[key] ?? (key === 'is_active' ? true : '');
            const choices = options(key);
            const required = kind === 'required' || kind.endsWith('_required') || (creatingVariant && ['wood_species_id', 'thickness_mm', 'width_mm', 'length_mm'].includes(key));
            const immutable = !!dialog.row && ['code', 'variant_code', 'customer_id'].includes(key);
            // Archive is always a separate confirmation; this control can only reactivate history.
            if (key === 'is_active' && value === true) return <input key={key} type="hidden" name={key} value="true" />;
            return <FormField key={key} label={label(key)} htmlFor={`master-${key}`}>
              {kind === 'boolean' ? <Select id={`master-${key}`} name={key} defaultValue={String(value)}><option value="true">{label('active')}</option><option value="false">{label('archived')}</option></Select> :
                choices ? <><Select id={`master-${key}`} name={immutable ? undefined : key} disabled={immutable} defaultValue={String(value)} required={required} onChange={event => setVariantDraft(old => ({...old, [key]: event.target.value}))}><option value="">{label('none')}</option>{choices.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</Select>{immutable ? <input type="hidden" name={key} value={String(value)} /> : null}</> :
                  ['notes', 'delivery_note'].includes(key) ? <Textarea id={`master-${key}`} name={key} defaultValue={String(value)} rows={3} /> :
                    <Input id={`master-${key}`} name={key} type={kind.startsWith('date') ? 'date' : 'text'} inputMode={['numeric', 'dimension', 'year'].includes(kind) ? 'decimal' : undefined} defaultValue={String(value)} readOnly={immutable} required={required} onChange={event => setVariantDraft(old => ({...old, [key]: event.target.value}))} />}
            </FormField>;
          })}
          {creatingVariant ? <div className="space-y-3" aria-live="polite">
            <p className="text-body-small text-text-secondary">{text('automaticVariantName')}</p>
            <FormField label={label('variant_code')} htmlFor="generated-variant-code"><Input id="generated-variant-code" name="variant_code" value={suggested?.code ?? ''} readOnly /></FormField>
            <FormField label={label('variant_name')} htmlFor="generated-variant-name"><Input id="generated-variant-name" name="variant_name" value={suggested?.name ?? ''} readOnly /></FormField>
            {!suggested ? <p>{text('variantNamingIncomplete')}</p> : !suggested.valid ? <p role="alert">{text('variantNamingTooLong')}</p> : duplicateCode ? <p role="alert">{text('variantCodeExists')}</p> : null}
          </div> : null}
        </>}
        {similar ? <p role="status">{label('duplicate')}</p> : null}
        <div className="flex justify-end gap-3"><Button variant="secondary" type="button" onClick={() => setDialog(null)}>{label('cancel')}</Button><Button type="submit" disabled={namingBlocked}>{label(dialog.archive ? 'archive' : 'save')}</Button></div>
      </SalesMutationForm> : null}
    </Dialog>
  </div>;
}
