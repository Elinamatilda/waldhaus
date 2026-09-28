'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Dialog, FormField, MultiCheckboxSelect, SectionHeader } from '@/components/ui';
import { SalesMutationForm } from './mutation-form';
import { saveProductWoodSpeciesAction } from '@/app/actions/product-master';
import { tApp } from '@/lib/i18n/app-ui';
import { tProduct } from '@/lib/i18n/product-master-ui';
import type { AppLocale } from '@/lib/i18n/config';

type Species = {id: string; name: string; is_active: boolean};
export function ProductSpeciesSelector({organizationId, productId, productName, productActive, locale, options, selected}: {
  organizationId: string; productId: string; productName: string; productActive: boolean;
  locale: AppLocale; options: Species[]; selected: Species[] | null;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [editing, setEditing] = useState<{expected: string[]; selected: string[]} | null>(null);
  const text = (key: Parameters<typeof tProduct>[1]) => tProduct(locale, key);
  const open = () => {
    const ids = (selected ?? []).map(row => row.id);
    setEditing({expected: ids, selected: ids});
  };
  return <div className="space-y-3">
    <SectionHeader title={tApp(locale, 'productMaster.wood_species')} actions={<Button variant="secondary" disabled={refreshing || !productActive} onClick={open}>{text('selectSpecies')}</Button>} />
    <p className="text-body-small text-text-secondary">{text('productSpeciesHint')}</p>
    {selected === null ? <p role="status" className="text-body-small text-text-secondary">{text('speciesUnavailable')}</p> : selected.length ? <div className="flex flex-wrap gap-2">{selected.map(row => <Badge key={row.id}>{row.name}{row.is_active ? '' : ` · ${tApp(locale, 'productMaster.archived')}`}</Badge>)}</div> : <p className="text-body-small text-text-secondary">{text('noProductSpecies')}</p>}
    <Dialog open={!!editing} title={tApp(locale, 'productMaster.wood_species')} description={productName} onClose={() => setEditing(null)}>
      {editing ? <SalesMutationForm action={saveProductWoodSpeciesAction} locale={locale} className="space-y-4" onSuccess={() => {setEditing(null); startRefresh(() => router.refresh());}}>
        <input type="hidden" name="organization_id" value={organizationId} />
        <input type="hidden" name="product_id" value={productId} />
        <input type="hidden" name="selection_present" value="true" />
        {editing.expected.map(id => <input key={id} type="hidden" name="expected_species_ids" value={id} />)}
        <FormField label={text('selectSpecies')} htmlFor="product-wood-species" help={text('productSpeciesHint')}>
          <MultiCheckboxSelect id="product-wood-species" name="wood_species_ids" label={tApp(locale, 'productMaster.wood_species')} placeholder={text('selectSpecies')} emptyLabel={text('speciesEmpty')}
            options={options.filter(row => row.is_active || editing.expected.includes(row.id)).map(row => ({id: row.id, name: row.is_active ? row.name : `${row.name} · ${tApp(locale, 'productMaster.archived')}`}))}
            value={editing.selected} onChange={ids => setEditing({...editing, selected: ids})} />
        </FormField>
        {selected === null ? <p role="status">{text('speciesUnavailable')}</p> : null}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => setEditing(null)}>{tApp(locale, 'productMaster.cancel')}</Button>
          <Button type="submit" disabled={selected === null}>{tApp(locale, 'productMaster.save')}</Button>
        </div>
      </SalesMutationForm> : null}
    </Dialog>
  </div>;
}
