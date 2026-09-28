import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isAppLocale, LOCALE_COOKIE, type AppLocale } from "./config";

export { SUPPORTED_LOCALES, type AppLocale } from "./config";

// Shared by layouts and pages; browser language never overrides the initial locale.
export const getRequestLocale = cache(async (): Promise<AppLocale> => {
  const cookieStore = await cookies();
  const preference = cookieStore.get(LOCALE_COOKIE)?.value;
  return isAppLocale(preference) ? preference : DEFAULT_LOCALE;
});
