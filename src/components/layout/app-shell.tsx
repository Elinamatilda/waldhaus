"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { AccessRole } from "@/lib/auth/types";
import type { AppLocale } from "@/lib/i18n/config";
import { tApp } from "@/lib/i18n/app-ui";
import { LanguageSelector } from "@/components/layout/language-selector";
import { tSales } from "@/lib/i18n/sales-ui";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { navGroups } from "@/components/navigation/nav-config";
import { Avatar, Button, Icon, SearchInput } from "@/components/ui";

type AppShellProps = {
  locale: AppLocale;
  children: ReactNode;
  role: AccessRole;
  userInitials: string;
  organizationContext: {
    isSystemAdmin: boolean;
    organizations: Array<{ id: string; name: string; slug: string }>;
    selectedOrganizationId: string | null;
    selectedOrganizationName: string | null;
  };
};

export function AppShell({ children, role, userInitials, organizationContext, locale }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const resolvedOrganizationContext =
    organizationContext ?? {
      isSystemAdmin: false,
      organizations: [],
      selectedOrganizationId: null,
      selectedOrganizationName: null,
    };

  const groups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          title: group.titleKey ? tApp(locale, group.titleKey) : group.title,
          items: group.items
            .filter((item) => (item.roles ? item.roles.includes(role) : true))
            .map((item) => ({
              ...item,
              label:
                role === "employee" && item.employeeLabelKey
                  ? tApp(locale, item.employeeLabelKey)
                  : item.labelKey
                    ? tApp(locale, item.labelKey)
                    : item.label,
            })),
        }))
        .filter((group) => group.items.length > 0),
    [locale, role],
  );

  return (
    <div className="min-h-screen bg-app-background text-text-primary">
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-border bg-surface px-3 py-4 app-shell-shadow",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          "transition-transform",
        )}
      >
        <div className="mb-6 flex items-center justify-between px-2">
          <div>
            <p className="text-label-small uppercase tracking-wider text-primary">Waldhaus</p>
            <p className="text-component-heading">{tApp(locale, "shell.description")}</p>
            {resolvedOrganizationContext.isSystemAdmin ? (
              <p className="mt-1 text-body-small text-text-secondary">
                {resolvedOrganizationContext.selectedOrganizationName ?? tSales(locale, "org.select")}
              </p>
            ) : resolvedOrganizationContext.selectedOrganizationName ? (
              <p className="mt-1 text-body-small text-text-secondary">
                {resolvedOrganizationContext.selectedOrganizationName}
              </p>
            ) : null}
          </div>
          <Button
            variant="icon"
            className="lg:hidden"
            aria-label={tApp(locale, "shell.closeNavigation")}
            onClick={() => setMobileOpen(false)}
          >
            <Icon name="close" className="h-4 w-4" />
          </Button>
        </div>
        <LanguageSelector locale={locale} />
        {resolvedOrganizationContext.isSystemAdmin ? (
          <OrganizationSwitcher
            locale={locale}
            organizations={resolvedOrganizationContext.organizations}
            selectedOrganizationId={resolvedOrganizationContext.selectedOrganizationId}
          />
        ) : null}
        <nav className="app-scrollbar min-h-0 flex-1 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.title || "root"} className="mb-4">
              {group.title ? (
                <p className="px-2 py-1 text-label-small uppercase tracking-wide text-text-muted">
                  {group.title}
                </p>
              ) : null}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-label",
                        active
                          ? "bg-primary-subtle text-primary"
                          : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
                      )}
                    >
                      <Icon name={item.icon} className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-app-background/95 px-4 backdrop-blur lg:px-6">
          <div className="flex w-full max-w-xl items-center gap-3">
            <Button
              variant="icon"
              className="lg:hidden"
              aria-label={tApp(locale, "shell.openNavigation")}
              onClick={() => setMobileOpen(true)}
            >
              <Icon name="menu" className="h-4 w-4" />
            </Button>
            <SearchInput placeholder={tApp(locale, "shell.search")} />
          </div>
          <div className="ml-3 flex items-center gap-2">
            <Button variant="icon" aria-label={tApp(locale, "shell.notifications")}>
              <Icon name="bell" className="h-4 w-4" />
            </Button>
            <Avatar initials={userInitials} />
          </div>
        </header>
        <main className="px-4 py-5 lg:px-6 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
