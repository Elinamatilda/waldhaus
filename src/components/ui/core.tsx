"use client";

import { useId, useState, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

export function Button({
  className,
  variant = "primary",
  loading,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "destructive" | "icon";
  loading?: boolean;
}) {
  const styles: Record<typeof variant, string> = {
    primary: "bg-primary text-white hover:bg-primary-hover",
    secondary: "bg-surface-subtle text-text-primary hover:bg-surface-hover border border-border",
    ghost: "bg-transparent text-text-secondary hover:bg-surface-subtle",
    destructive: "bg-destructive text-white hover:brightness-95",
    icon: "bg-surface-subtle text-text-secondary hover:bg-surface-hover",
  };

  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-label font-medium",
        styles[variant],
        variant === "icon" ? "h-9 w-9 px-0" : "",
        className,
      )}
    >
      {loading ? "Loading..." : children}
    </button>
  );
}

export const IconButton = Button;

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-lg border border-border bg-surface-raised p-4 raised-shadow",
        className,
      )}
    />
  );
}

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "destructive" | "operational";
}) {
  const toneClass: Record<typeof tone, string> = {
    default: "text-text-secondary",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
    operational: "text-operational",
  };

  return (
    <Card className="raised-shadow-hover">
      <p className="text-label text-text-secondary">{label}</p>
      <p className="mt-2 text-page-title text-text-primary">{value}</p>
      {hint ? <p className={cn("mt-2 text-body-small", toneClass[tone])}>{hint}</p> : null}
    </Card>
  );
}

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-surface-subtle px-2.5 py-1 text-label-small text-text-secondary",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({
  status,
  children,
}: {
  status: "neutral" | "info" | "success" | "warning" | "error" | "operational";
  children: ReactNode;
}) {
  const map: Record<typeof status, string> = {
    neutral: "bg-surface-subtle text-text-secondary",
    info: "bg-primary-subtle text-primary",
    success: "bg-[#ddf6e8] text-success",
    warning: "bg-[#ffeccb] text-warning",
    error: "bg-[#ffdad6] text-destructive",
    operational: "bg-[#d9f2f6] text-operational",
  };
  return <Badge className={map[status]}>{children}</Badge>;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-9 w-full rounded-lg border border-border bg-surface-raised px-3 text-body text-text-primary placeholder:text-text-muted",
        props.className,
      )}
    />
  );
}

export function SearchInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex h-9 items-center rounded-lg border border-border bg-surface-raised px-3">
      <Icon name="search" className="mr-2 h-4 w-4 text-text-muted" />
      <Input {...props} className="h-auto border-0 bg-transparent px-0" />
    </div>
  );
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-body text-text-primary placeholder:text-text-muted",
        props.className,
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(
          "h-9 w-full appearance-none rounded-lg border border-border bg-surface-raised px-3 pr-8 text-body text-text-primary",
          props.className,
        )}
      />
      <Icon name="chevronDown" className="pointer-events-none absolute right-2 top-2 h-5 w-5 text-text-muted" />
    </div>
  );
}

export function Checkbox(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      {...props}
      className={cn("h-4 w-4 rounded border-border text-primary", props.className)}
    />
  );
}

export function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-10 rounded-full",
        checked ? "bg-primary" : "bg-surface-hover",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
          checked ? "left-4" : "left-0.5",
        )}
      />
    </button>
  );
}

export function FormField({
  label,
  help,
  error,
  htmlFor,
  children,
}: {
  label: string;
  help?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  const generated = useId();
  const controlId = htmlFor ?? generated;
  return (
    <div className="space-y-1.5">
      <label htmlFor={controlId} className="text-label text-text-secondary">
        {label}
      </label>
      <div>{children}</div>
      {help ? <p className="text-body-small text-text-muted">{help}</p> : null}
      {error ? <p className="text-body-small text-destructive">{error}</p> : null}
    </div>
  );
}

export function Dialog({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg rounded-lg border border-border bg-surface-raised p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-component-heading text-text-primary">{title}</h3>
        {description ? <p className="mt-1 text-body text-text-secondary">{description}</p> : null}
        <div className="mt-4">{children}</div>
      </section>
    </div>
  );
}

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} title={title} description={description} onClose={onClose}>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

export function Drawer({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className={cn("fixed inset-0 z-50", open ? "block" : "hidden")}>
      <button className="absolute inset-0 bg-black/25" aria-label="Close drawer" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md border-l border-border bg-surface-raised p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-component-heading">{title}</h3>
          <IconButton variant="icon" aria-label="Close" onClick={onClose}>
            <Icon name="close" className="h-4 w-4" />
          </IconButton>
        </div>
        {children}
      </aside>
    </div>
  );
}

export function DropdownMenu({
  label,
  items,
}: {
  label: ReactNode;
  items: Array<{ label: string; onSelect: () => void }>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className="rounded-lg" onClick={() => setOpen((v) => !v)}>
        {label}
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 min-w-36 rounded-lg border border-border bg-surface-raised p-1 shadow-md">
          {items.map((item) => (
            <button
              key={item.label}
              className="block w-full rounded-md px-2 py-1.5 text-left text-body hover:bg-surface-subtle"
              onClick={() => {
                item.onSelect();
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Tooltip({
  text,
  children,
}: {
  text: string;
  children: ReactNode;
}) {
  return (
    <span title={text} className="inline-flex">
      {children}
    </span>
  );
}

export function Tabs({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (value: string) => void;
  items: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-surface-subtle p-1">
      {items.map((item) => (
        <button
          key={item.value}
          className={cn(
            "rounded-md px-3 py-1.5 text-label",
            value === item.value
              ? "bg-surface-raised text-text-primary raised-shadow"
              : "text-text-secondary hover:text-text-primary",
          )}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function SegmentedControl({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; count?: number }>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg bg-surface-subtle p-1">
      {options.map((option) => (
        <button
          key={option.value}
          className={cn(
            "rounded-md px-3 py-1.5 text-label",
            value === option.value
              ? "bg-surface-raised text-text-primary raised-shadow"
              : "text-text-secondary",
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {typeof option.count === "number" ? (
            <span className="ml-1 rounded-full bg-surface-hover px-1.5 py-0.5 text-label-small">
              {option.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table {...props} className={cn("w-full border-collapse", className)} />;
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} className={cn("bg-surface-subtle text-label-small uppercase tracking-wide text-text-secondary", className)} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} className={cn("divide-y divide-border text-body", className)} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} className={cn("hover:bg-surface/80", className)} />;
}

export function TableCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <td {...props} className={cn("px-4 py-3 align-middle", className)} />;
}

export function Pagination({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-border bg-surface-subtle px-4 py-3">
      <p className="text-body-small text-text-secondary">Page {page} of {total}</p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => onPage(page - 1)} disabled={page <= 1}>
          <Icon name="chevronLeft" className="h-4 w-4" />
          Previous
        </Button>
        <Button variant="secondary" onClick={() => onPage(page + 1)} disabled={page >= total}>
          Next
          <Icon name="chevronRight" className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "primary",
}: {
  value: number;
  tone?: "primary" | "success" | "warning" | "destructive";
}) {
  const color: Record<typeof tone, string> = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
  };
  return (
    <div className="h-2 w-full rounded-full bg-surface-hover">
      <div className={cn("h-2 rounded-full", color[tone])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-hover", className)} />;
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="text-center">
      <p className="text-component-heading">{title}</p>
      <p className="mt-2 text-body text-text-secondary">{description}</p>
    </Card>
  );
}

export function Alert({
  tone,
  title,
  description,
}: {
  tone: "info" | "warning" | "error" | "success";
  title: string;
  description: string;
}) {
  const map = {
    info: "border-primary/20 bg-primary-subtle text-primary",
    warning: "border-warning/25 bg-[#ffeccb] text-warning",
    error: "border-destructive/25 bg-[#ffdad6] text-destructive",
    success: "border-success/25 bg-[#ddf6e8] text-success",
  } as const;
  return (
    <div className={cn("rounded-lg border p-3", map[tone])} role="status">
      <p className="text-label font-semibold">{title}</p>
      <p className="mt-1 text-body-small">{description}</p>
    </div>
  );
}

export function Avatar({ initials }: { initials: string }) {
  return (
    <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-label text-white">
      {initials}
    </div>
  );
}

export function ToastFoundation() {
  return <div id="toast-root" aria-live="polite" aria-atomic="true" className="pointer-events-none fixed right-4 top-4 z-50" />;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? <p className="text-label uppercase tracking-wider text-primary">{eyebrow}</p> : null}
        <h1 className="text-page-title text-text-primary">{title}</h1>
        {description ? <p className="mt-1 text-body text-text-secondary">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-section-title text-text-primary">{title}</h2>
        {description ? <p className="text-body-small text-text-secondary">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      {children}
    </Card>
  );
}
