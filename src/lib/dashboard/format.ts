import type { AppLocale } from '@/lib/i18n/config';
export const localeTag = (locale: AppLocale) => ({ fi: 'fi-FI', pl: 'pl-PL', en: 'en-GB' })[locale];
export const money = (locale: AppLocale, value: number | null, compact = false) => value === null ? '—' : new Intl.NumberFormat(localeTag(locale), { style: 'currency', currency: 'EUR', ...(compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}) }).format(value);
export const percent = (locale: AppLocale, value: number | null) => value === null ? '—' : new Intl.NumberFormat(localeTag(locale), { style: 'percent', maximumFractionDigits: 1 }).format(value / 100);
export const monthName = (locale: AppLocale, month: number, short = false) => new Intl.DateTimeFormat(localeTag(locale), { month: short ? 'short' : 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, month - 1, 1)));
