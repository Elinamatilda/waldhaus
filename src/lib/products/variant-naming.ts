import { decimalInput } from './model';

type Lookup = {code: string; name: string};
// Codes use canonical catalogue codes, never translated display names.
const token = (value: string) => value.trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
const dimension = (value: string | undefined) => {
  try {
    const parsed = decimalInput(value ?? '', 3, true);
    return parsed === null ? null : String(Number(parsed));
  } catch { return null; }
};

export function suggestVariantName(product: {id: string; product_code: string | null; name: string}, species: Lookup | null, construction: Lookup | null, draft: Record<string, string>) {
  const measures = ['thickness_mm', 'width_mm', 'length_mm'].map(key => dimension(draft[key]));
  if (!species || measures.some(value => value === null)) return null;
  const quality = draft.quality_code?.trim();
  const code = [token(product.product_code ?? '') || `P-${product.id.toUpperCase()}`, species.code.toUpperCase(), construction?.code.toUpperCase(), quality ? `Q-${token(quality)}` : null, measures.join('X')].filter(Boolean).join('-');
  const name = [product.name, species.name, construction?.name, quality, `${measures.join(' × ')} mm`].filter(Boolean).join(', ');
  return {code, name, valid: code.length <= 80 && name.length <= 200};
}
