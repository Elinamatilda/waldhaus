import type { AppLocale } from "./locale";

export type SalesNavKey =
  | "sales.group"
  | "sales.overview"
  | "sales.customers"
  | "sales.products"
  | "sales.planning"
  | "sales.actuals"
  | "sales.title"
  | "sales.selectOrganization"
  | "sales.schemaMissing"
  | "sales.empty"
  | "sales.year"
  | "sales.scenario"
  | "sales.customer"
  | "sales.product"
  | "sales.variant"
  | "sales.save"
  | "sales.quantity"
  | "sales.volume"
  | "sales.unitPrice"
  | "sales.revenue"
  | "sales.pricingBasis"
  | "sales.currency"
  | "sales.add"
  | "sales.name"
  | "sales.code"
  | "sales.notes"
  | "sales.description"
  | "sales.search"
  | "sales.status"
  | "sales.active"
  | "sales.archived"
  | "sales.noData"
  | "sales.month"
  | "sales.total"
  | "sales.actions"
  | "sales.edit"
  | "sales.budget"
  | "sales.forecast"
  | "sales.actual"
  | "sales.avgPrice"
  | "sales.monthlyTrend"
  | "sales.byCustomer"
  | "sales.byProduct"
  | "sales.mix"
  | "sales.validationRequired"
  | "sales.validationCurrency"
  | "sales.validationPricingBasis"
  | "sales.validationNonNegative"
  | "sales.create"
  | "sales.select"
  | "sales.actualsManual"
  | "sales.planningGridTitle"
  | "sales.variantOptional"
  | "sales.scenario.budget"
  | "sales.scenario.forecast"
  | "sales.scenario.actual"
  | "org.label"
  | "org.select"
  | "org.switch";

const translations: Record<AppLocale, Record<SalesNavKey, string>> = {
  fi: {
    "sales.group": "MYYNTI",
    "sales.overview": "Yleiskuva",
    "sales.customers": "Asiakkaat",
    "sales.products": "Tuotteet",
    "sales.planning": "Budjetti & ennuste",
    "sales.actuals": "Toteuma",
    "sales.title": "Myynti",
    "sales.selectOrganization": "Valitse organisaatio",
    "sales.schemaMissing": "Myyntimoduulin skeema puuttuu. Suorita ensin myynnin perusmigraatio.",
    "sales.empty": "Ei tietoja tälle valinnalle.",
    "sales.year": "Vuosi",
    "sales.scenario": "Skenaario",
    "sales.customer": "Asiakas",
    "sales.product": "Tuote",
    "sales.variant": "Variantti",
    "sales.save": "Tallenna",
    "sales.quantity": "Määrä",
    "sales.volume": "Tilavuus m3",
    "sales.unitPrice": "Yksikkohinta",
    "sales.revenue": "Liikevaihto",
    "sales.pricingBasis": "Hinnoitteluperuste",
    "sales.currency": "Valuutta",
    "sales.add": "Lisää",
    "sales.name": "Nimi",
    "sales.code": "Koodi",
    "sales.notes": "Muistiinpanot",
    "sales.description": "Kuvaus",
    "sales.search": "Haku",
    "sales.status": "Tila",
    "sales.active": "Aktiivinen",
    "sales.archived": "Arkistoitu",
    "sales.noData": "Ei tietoja",
    "sales.month": "Kuukausi",
    "sales.total": "Yhteensä",
    "sales.actions": "Toiminnot",
    "sales.edit": "Muokkaa",
    "sales.budget": "Budjetti",
    "sales.forecast": "Ennuste",
    "sales.actual": "Toteuma",
    "sales.avgPrice": "Keskihinta",
    "sales.monthlyTrend": "Kuukausitrendi",
    "sales.byCustomer": "Myynti asiakkaittain",
    "sales.byProduct": "Myynti tuotteittain",
    "sales.mix": "Asiakas-tuotejakauma",
    "sales.validationRequired": "Pakollinen kenttä puuttuu.",
    "sales.validationCurrency": "Valuuttakoodi on virheellinen.",
    "sales.validationPricingBasis": "Hinnoitteluperuste on virheellinen.",
    "sales.validationNonNegative": "Arvon on oltava nolla tai suurempi.",
    "sales.create": "Luo",
    "sales.select": "Valitse",
    "sales.actualsManual": "Toteuma syötetään tässä vaiheessa manuaalisesti.",
    "sales.planningGridTitle": "Vuosisuunnittelu",
    "sales.variantOptional": "Variantti (valinnainen)",
    "sales.scenario.budget": "Budjetti",
    "sales.scenario.forecast": "Ennuste",
    "sales.scenario.actual": "Toteuma",
    "org.label": "Organisaatio",
    "org.select": "Valitse organisaatio",
    "org.switch": "Vaihda organisaatiota",
  },
  pl: {
    "sales.group": "SPRZEDAŻ",
    "sales.overview": "Przegląd",
    "sales.customers": "Klienci",
    "sales.products": "Produkty",
    "sales.planning": "Budżet i prognoza",
    "sales.actuals": "Realizacja",
    "sales.title": "Sprzedaż",
    "sales.selectOrganization": "Wybierz organizację",
    "sales.schemaMissing": "Brak schematu modułu sprzedaży. Najpierw zastosuj migrację bazową sprzedaży.",
    "sales.empty": "Brak danych dla wybranego zakresu.",
    "sales.year": "Rok",
    "sales.scenario": "Scenariusz",
    "sales.customer": "Klient",
    "sales.product": "Produkt",
    "sales.variant": "Wariant",
    "sales.save": "Zapisz",
    "sales.quantity": "Ilość",
    "sales.volume": "Objętość m3",
    "sales.unitPrice": "Cena jednostkowa",
    "sales.revenue": "Przychód",
    "sales.pricingBasis": "Podstawa ceny",
    "sales.currency": "Waluta",
    "sales.add": "Dodaj",
    "sales.name": "Nazwa",
    "sales.code": "Kod",
    "sales.notes": "Uwagi",
    "sales.description": "Opis",
    "sales.search": "Szukaj",
    "sales.status": "Status",
    "sales.active": "Aktywny",
    "sales.archived": "Zarchiwizowany",
    "sales.noData": "Brak danych",
    "sales.month": "Miesiąc",
    "sales.total": "Suma",
    "sales.actions": "Akcje",
    "sales.edit": "Edytuj",
    "sales.budget": "Budżet",
    "sales.forecast": "Prognoza",
    "sales.actual": "Realizacja",
    "sales.avgPrice": "Średnia cena",
    "sales.monthlyTrend": "Trend miesięczny",
    "sales.byCustomer": "Sprzedaż wg klientów",
    "sales.byProduct": "Sprzedaż wg produktów",
    "sales.mix": "Mix klient × produkt",
    "sales.validationRequired": "Brak wymaganego pola.",
    "sales.validationCurrency": "Nieprawidłowy kod waluty.",
    "sales.validationPricingBasis": "Nieprawidłowa podstawa ceny.",
    "sales.validationNonNegative": "Wartość musi być równa 0 lub większa.",
    "sales.create": "Utwórz",
    "sales.select": "Wybierz",
    "sales.actualsManual": "Wartości realizacji są na tym etapie wprowadzane ręcznie.",
    "sales.planningGridTitle": "Plan roczny",
    "sales.variantOptional": "Wariant (opcjonalnie)",
    "sales.scenario.budget": "Budżet",
    "sales.scenario.forecast": "Prognoza",
    "sales.scenario.actual": "Realizacja",
    "org.label": "Organizacja",
    "org.select": "Wybierz organizację",
    "org.switch": "Zmień organizację",
  },
  en: {
    "sales.group": "Sales",
    "sales.overview": "Overview",
    "sales.customers": "Customers",
    "sales.products": "Products",
    "sales.planning": "Budget & Forecast",
    "sales.actuals": "Actuals",
    "sales.title": "Sales",
    "sales.selectOrganization": "Select organization",
    "sales.schemaMissing": "Sales schema is missing. Apply the sales foundation migration first.",
    "sales.empty": "No data for this selection.",
    "sales.year": "Year",
    "sales.scenario": "Scenario",
    "sales.customer": "Customer",
    "sales.product": "Product",
    "sales.variant": "Variant",
    "sales.save": "Save",
    "sales.quantity": "Quantity",
    "sales.volume": "Volume m3",
    "sales.unitPrice": "Unit Price",
    "sales.revenue": "Revenue",
    "sales.pricingBasis": "Pricing Basis",
    "sales.currency": "Currency",
    "sales.add": "Add",
    "sales.name": "Name",
    "sales.code": "Code",
    "sales.notes": "Notes",
    "sales.description": "Description",
    "sales.search": "Search",
    "sales.status": "Status",
    "sales.active": "Active",
    "sales.archived": "Archived",
    "sales.noData": "No data",
    "sales.month": "Month",
    "sales.total": "Total",
    "sales.actions": "Actions",
    "sales.edit": "Edit",
    "sales.budget": "Budget",
    "sales.forecast": "Forecast",
    "sales.actual": "Actual",
    "sales.avgPrice": "Average Price",
    "sales.monthlyTrend": "Monthly Trend",
    "sales.byCustomer": "Sales by Customer",
    "sales.byProduct": "Sales by Product",
    "sales.mix": "Customer × Product Mix",
    "sales.validationRequired": "Required field is missing.",
    "sales.validationCurrency": "Invalid currency code.",
    "sales.validationPricingBasis": "Invalid pricing basis.",
    "sales.validationNonNegative": "Value must be zero or greater.",
    "sales.create": "Create",
    "sales.select": "Select",
    "sales.actualsManual": "Actual values are entered manually at this stage.",
    "sales.planningGridTitle": "Annual Planning",
    "sales.variantOptional": "Variant (optional)",
    "sales.scenario.budget": "Budget",
    "sales.scenario.forecast": "Forecast",
    "sales.scenario.actual": "Actual",
    "org.label": "Organization",
    "org.select": "Select organization",
    "org.switch": "Switch organization",
  },
};

export function tScenarioCode(locale: AppLocale, code: string) {
  if (code === "BUDGET") {
    return tSales(locale, "sales.scenario.budget");
  }

  if (code === "FORECAST") {
    return tSales(locale, "sales.scenario.forecast");
  }

  if (code === "ACTUAL") {
    return tSales(locale, "sales.scenario.actual");
  }

  return code;
}

export function tSales(locale: AppLocale, key: SalesNavKey) {
  return translations[locale][key] ?? translations.en[key];
}

export function salesMonthLabels(locale: AppLocale) {
  if (locale === "fi") {
    return ["Tammi", "Helmi", "Maalis", "Huhti", "Touko", "Kesä", "Heinä", "Elo", "Syys", "Loka", "Marras", "Joulu"];
  }

  if (locale === "pl") {
    return ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paz", "Lis", "Gru"];
  }

  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
}
