"use client";

import { useFormStatus } from "react-dom";
import { selectLocaleAction } from "@/app/actions/locale";
import { Button, Select } from "@/components/ui";
import type { AppLocale } from "@/lib/i18n/config";
import { tApp } from "@/lib/i18n/app-ui";

function LanguageControls({ locale }: { locale: AppLocale }) {
  const { pending } = useFormStatus();

  return (
    <>
      <label htmlFor="app-language" className="text-label text-text-secondary">
        {tApp(locale, "locale.label")}
      </label>
      <Select id="app-language" name="locale" defaultValue={locale} disabled={pending}>
        <option value="fi" lang="fi">Suomi</option>
        <option value="en" lang="en">English</option>
        <option value="pl" lang="pl">Polski</option>
      </Select>
      <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending}>
        {tApp(locale, pending ? "locale.pending" : "locale.apply")}
      </Button>
    </>
  );
}

export function LanguageSelector({ locale }: { locale: AppLocale }) {
  return (
    <form key={locale} action={selectLocaleAction} className="mb-4 space-y-2 px-2">
      <LanguageControls locale={locale} />
    </form>
  );
}
