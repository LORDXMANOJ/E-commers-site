import type { ReactNode } from "react";

export function AdminHeader({ title, children, description }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <title>{`${title} · Aurelle admin`}</title>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export const panel = "rounded-[var(--radius-card)] border border-line bg-surface";
export const th = "px-4 py-2.5 text-left text-xs font-medium text-muted whitespace-nowrap";
export const td = "px-4 py-3 align-middle";
