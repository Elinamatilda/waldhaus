import { headers } from "next/headers";

export const SUPPORTED_LOCALES = ["fi", "pl", "en"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

function normalizeLocale(raw: string | null | undefined): AppLocale | null {
  if (!raw) {
    return null;
  }

  const token = raw.toLowerCase().split("-")[0]?.trim();

  if (token === "fi" || token === "pl" || token === "en") {
    return token;
  }

  return null;
}

export async function getRequestLocale(): Promise<AppLocale> {
  const headerStore = await headers();
  const cookieLocale = normalizeLocale(headerStore.get("x-waldhaus-locale"));

  if (cookieLocale) {
    return cookieLocale;
  }

  const acceptLanguage = headerStore.get("accept-language") ?? "";
  const candidates = acceptLanguage
    .split(",")
    .map((part) => normalizeLocale(part.split(";")[0]))
    .filter((value): value is AppLocale => value !== null);

  return candidates[0] ?? "en";
}
