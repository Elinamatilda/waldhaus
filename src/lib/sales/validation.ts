export type MutationCode = 'VALIDATION_ERROR' | 'CONFLICT' | 'FORBIDDEN' | 'NOT_FOUND' | 'DATABASE_ERROR';
export type MutationResult = { ok: true; id?: string } | { ok: false; code: MutationCode; message: string };
export class SalesValidationError extends Error {}
export type NumericInput = { state: 'EMPTY' } | { state: 'INVALID'; original: string } | { state: 'VALID'; value: number };
export function parseNumericInput(input: FormDataEntryValue | null): NumericInput {
  const original = typeof input === 'string' ? input.trim() : input === null ? '' : '[file]';
  if (!original) return {state:'EMPTY'};
  if (!/^\d+(?:[.,]\d{1,6})?$/.test(original)) return {state:'INVALID',original};
  const value = Number(original.replace(',','.'));
  return Number.isFinite(value) && value < 1e12 ? {state:'VALID',value} : {state:'INVALID',original};
}
export function validateYear(value: number) {
  if (!Number.isInteger(value) || value < 2020 || value > 2100) throw new SalesValidationError('Year must be between 2020 and 2100.');
  return value;
}
export function numericOrEmpty(input: FormDataEntryValue | null): number | null {
  const result = parseNumericInput(input);
  if (result.state === 'INVALID') throw new SalesValidationError('Invalid non-negative number. Use at most six decimal places.');
  return result.state === 'EMPTY' ? null : result.value;
}
export function uuid(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new SalesValidationError('Invalid identifier.');
  return value;
}
export function parseAnnualForm(form: FormData) {
  const year = validateYear(Number(form.get('year')));
  const customer = uuid(String(form.get('customer_id') ?? ''));
  const product = uuid(String(form.get('product_id') ?? ''));
  const variant = form.get('product_variant_id') ? uuid(String(form.get('product_variant_id'))) : null;
  const months = Array.from({length:12}, (_,index) => {
    const month = index + 1;
    const expectedId = String(form.get(`id_${month}`) ?? '') || null;
    const expectedVersion = String(form.get(`version_${month}`) ?? '') || null;
    if (expectedId) uuid(expectedId);
    if (Boolean(expectedId) !== Boolean(expectedVersion) || (expectedVersion && !/^\d+$/.test(expectedVersion))) throw new SalesValidationError('Missing edit version. Refresh before saving.');
    const base = {month, expected_id:expectedId, expected_version:expectedVersion};
    if (form.get(`delete_${month}`) === 'on') {
      if (!expectedId || form.get('confirm_delete') !== 'on') throw new SalesValidationError('Confirm deletion of the selected months.');
      return {...base, operation:'delete' as const};
    }
    const quantity = numericOrEmpty(form.get(`quantity_${month}`));
    const volume = numericOrEmpty(form.get(`volume_${month}`));
    const price = numericOrEmpty(form.get(`unit_price_${month}`));
    const revenue = numericOrEmpty(form.get(`revenue_${month}`));
    if ([quantity,volume,price,revenue].every(value => value === null)) return {...base, operation:'keep' as const};
    const unit = String(form.get(`quantity_unit_${month}`) ?? '');
    const basis = String(form.get(`pricing_basis_${month}`) ?? '') || null;
    const currency = String(form.get(`currency_${month}`) ?? '').trim().toUpperCase();
    const mode = String(form.get(`revenue_mode_${month}`) ?? '');
    if (!['PIECE','LINEAR_METER'].includes(unit) || !/^[A-Z]{3}$/.test(currency)) throw new SalesValidationError(`Month ${month}: invalid unit or currency.`);
    if (basis !== null && !['PER_PIECE','PER_M3'].includes(basis)) throw new SalesValidationError(`Month ${month}: invalid pricing basis.`);
    if (basis === 'PER_PIECE' && unit !== 'PIECE') throw new SalesValidationError(`Month ${month}: per-piece price requires PIECE.`);
    if (!['CALCULATED','MANUAL'].includes(mode)) throw new SalesValidationError(`Month ${month}: select the revenue mode.`);
    if (mode === 'CALCULATED' && (price === null || !basis || (basis === 'PER_PIECE' ? quantity : volume) === null)) throw new SalesValidationError(`Month ${month}: calculated revenue requires price and its quantity/volume.`);
    if (mode === 'MANUAL' && revenue === null) throw new SalesValidationError(`Month ${month}: enter manual revenue.`);
    return {...base, operation:'save' as const, quantity, volume, price, revenue:mode === 'MANUAL' ? revenue : null, unit, basis, currency, mode};
  });
  return {year, customer, product, variant, months};
}
