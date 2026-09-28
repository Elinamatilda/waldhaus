import type { AppMessageKey } from "@/lib/i18n/app-ui";
import type { AccessRole } from "@/lib/auth/types";

export type NavItem = {
  label: string;
  labelKey?: AppMessageKey;
  employeeLabelKey?: AppMessageKey;
  href: string;
  icon:
    | "dashboard"
    | "production"
    | "inventory"
    | "orders"
    | "purchasing"
    | "sales"
    | "reports"
    | "settings";
  roles?: AccessRole[];
};

export type NavGroup = {
  title: string;
  titleKey?: AppMessageKey;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    title: "Overview", titleKey: "nav.overview",
    items: [{ label: "Dashboard", labelKey: "nav.dashboard", href: "/dashboard", icon: "dashboard", roles: ["system_admin", "admin"] }],
  },
  {
    title: "Operations", titleKey: "nav.operations",
    items: [
      {
        label: "Production", labelKey: "nav.production",
        employeeLabelKey: "nav.myWork",
        href: "/production",
        icon: "production",
        roles: ["system_admin", "admin", "employee"],
      },
      { label: "Inventory", labelKey: "nav.inventory", href: "/inventory", icon: "inventory", roles: ["system_admin", "admin", "employee"] },
      { label: "Orders", labelKey: "nav.orders", href: "/orders", icon: "orders", roles: ["system_admin", "admin"] },
    ],
  },
  {
    title: "Sales",
    titleKey: "sales.group",
    items: [
      {
        label: "Overview",
        labelKey: "sales.overview",
        href: "/sales",
        icon: "sales",
        roles: ["system_admin", "admin"],
      },
      {
        label: "Customers",
        labelKey: "sales.customers",
        href: "/sales/customers",
        icon: "sales",
        roles: ["system_admin", "admin"],
      },
      {
        label: "Products",
        labelKey: "sales.products",
        href: "/sales/products",
        icon: "sales",
        roles: ["system_admin", "admin"],
      },
      {
        label: "Actuals",
        labelKey: "sales.actuals",
        href: "/sales/actuals",
        icon: "sales",
        roles: ["system_admin", "admin"],
      },
    ],
  },
  {
    title: "Budget", titleKey: "nav.budget",
    items: [
      { label: "Overview", labelKey: "nav.budgetOverview", href: "/budget", icon: "reports", roles: ["system_admin", "admin"] },
      { label: "Annual Budget", labelKey: "nav.annualBudget", href: "/budget/annual", icon: "reports", roles: ["system_admin", "admin"] },
      { label: "Cash Flow Budget", labelKey: "nav.cashFlowBudget", href: "/budget/cash-flow", icon: "reports", roles: ["system_admin", "admin"] },
      { label: "Liquidity Forecast", labelKey: "nav.liquidityForecast", href: "/budget/liquidity", icon: "reports", roles: ["system_admin", "admin"] },
      { label: "Sales Budget & Forecast", labelKey: "nav.salesBudgetForecast", href: "/budget/sales", icon: "sales", roles: ["system_admin", "admin"] },
    ],
  },
  {
    title: "Management", titleKey: "nav.management",
    items: [{ label: "Reports", labelKey: "nav.reports", href: "/reports", icon: "reports", roles: ["system_admin", "admin"] }],
  },
  {
    title: "System", titleKey: "nav.system",
    items: [{ label: "Settings", labelKey: "nav.settings", href: "/settings", icon: "settings", roles: ["system_admin", "admin"] }],
  },
];
