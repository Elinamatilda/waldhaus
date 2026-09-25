import type { AccessRole } from "@/lib/auth/types";

export type NavItem = {
  label: string;
  labelKey?: string;
  employeeLabel?: string;
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
  titleKey?: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    title: "",
    items: [{ label: "Dashboard", href: "/dashboard", icon: "dashboard", roles: ["system_admin", "admin", "employee"] }],
  },
  {
    title: "Operations",
    items: [
      {
        label: "Production",
        employeeLabel: "My Work / Production",
        href: "/production",
        icon: "production",
        roles: ["system_admin", "admin", "employee"],
      },
      { label: "Inventory", href: "/inventory", icon: "inventory", roles: ["system_admin", "admin", "employee"] },
      { label: "Orders", href: "/orders", icon: "orders", roles: ["system_admin", "admin"] },
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
        label: "Budget & Forecast",
        labelKey: "sales.planning",
        href: "/sales/planning",
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
    title: "Commercial",
    items: [{ label: "Purchasing", href: "/purchasing", icon: "purchasing", roles: ["system_admin", "admin"] }],
  },
  {
    title: "Management",
    items: [{ label: "Reports", href: "/reports", icon: "reports", roles: ["system_admin", "admin"] }],
  },
  {
    title: "System",
    items: [{ label: "Settings", href: "/settings", icon: "settings", roles: ["system_admin", "admin"] }],
  },
];
