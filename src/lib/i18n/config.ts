export const SUPPORTED_LOCALES = ["fi", "pl", "en"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "fi";
export const LOCALE_COOKIE = "waldhaus-locale";

export function isAppLocale(value: unknown): value is AppLocale {
  return value === "fi" || value === "pl" || value === "en";
}
