export type ClientLocale = "fi" | "pl" | "en";

export function getClientLocale(): ClientLocale {
  if (typeof navigator === "undefined") {
    return "en";
  }

  const language = navigator.language.toLowerCase();

  if (language.startsWith("fi")) {
    return "fi";
  }

  if (language.startsWith("pl")) {
    return "pl";
  }

  return "en";
}
