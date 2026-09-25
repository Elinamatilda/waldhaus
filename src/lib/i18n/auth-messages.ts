import type { AppLocale } from "./locale";

const loginSubtitleByLocale: Record<AppLocale, string> = {
  fi: "Kirjaudu sisaan kayttaaksesi Waldhausia.",
  pl: "Zaloguj sie, aby korzystac z Waldhaus.",
  en: "Sign in to access Waldhaus.",
};

export function getLoginSubtitle(locale: AppLocale) {
  return loginSubtitleByLocale[locale] ?? loginSubtitleByLocale.en;
}
