import type { SVGProps } from "react";

type IconName =
  | "dashboard"
  | "inventory"
  | "orders"
  | "production"
  | "purchasing"
  | "sales"
  | "reports"
  | "settings"
  | "search"
  | "menu"
  | "close"
  | "bell"
  | "user"
  | "plus"
  | "download"
  | "edit"
  | "eye"
  | "warning"
  | "check"
  | "truck"
  | "filter"
  | "chevronDown"
  | "chevronLeft"
  | "chevronRight";

const paths: Record<IconName, string> = {
  dashboard: "M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z",
  inventory: "M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4M3 17l9 4 9-4",
  orders: "M6 3h9l5 5v13H6zM15 3v5h5",
  production: "M4 14h16M6 10h12M8 6h8M7 14v7M17 14v7",
  purchasing: "M4 6h17l-2 8H8L6 4H3M10 20a1 1 0 100 .01M17 20a1 1 0 100 .01",
  sales: "M4 18h16M6 15l4-4 3 3 5-6",
  reports: "M4 19h16M7 16V9M12 16V5M17 16v-3",
  settings: "M12 8a4 4 0 100 8 4 4 0 000-8zm8 4l2 1-2 3-2-1a8 8 0 01-2 1l-.3 2h-4l-.3-2a8 8 0 01-2-1l-2 1-2-3 2-1a8 8 0 010-2l-2-1 2-3 2 1a8 8 0 012-1l.3-2h4l.3 2a8 8 0 012 1l2-1 2 3-2 1a8 8 0 010 2z",
  search: "M11 4a7 7 0 105.3 11.7l3 3 1.4-1.4-3-3A7 7 0 0011 4z",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  bell: "M18 16H6l1-2v-3a5 5 0 1110 0v3l1 2zM10 18a2 2 0 004 0",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0",
  plus: "M12 5v14M5 12h14",
  download: "M12 4v10M8 10l4 4 4-4M5 19h14",
  edit: "M4 20h4l10-10-4-4L4 16v4zM13 7l4 4",
  eye: "M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6zm10 3a3 3 0 100-6 3 3 0 000 6z",
  warning: "M12 3l10 18H2L12 3zm0 6v5m0 3h.01",
  check: "M5 12l4 4 10-10",
  truck: "M3 7h12v9H3zM15 10h4l2 2v4h-6M7 18a2 2 0 100 .01M17 18a2 2 0 100 .01",
  filter: "M4 6h16M7 12h10M10 18h4",
  chevronDown: "M6 9l6 6 6-6",
  chevronLeft: "M15 6l-6 6 6 6",
  chevronRight: "M9 6l6 6-6 6",
};

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
};

export function Icon({ name, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d={paths[name]} />
    </svg>
  );
}
