"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isAppLocale, LOCALE_COOKIE } from "@/lib/i18n/config";

export async function selectLocaleAction(formData: FormData) {
  const locale = formData.get("locale");
  if (!isAppLocale(locale)) {
    throw new Error("Unsupported locale.");
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  // Refresh the entire route tree after persistence, including prefetched pages.
  revalidatePath("/", "layout");
}
