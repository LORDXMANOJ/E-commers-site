import type { ReactNode } from "react";

/** Shared frame for sign-in, register and password pages: one narrow, calm column. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="container-page flex justify-center pt-12 pb-8 sm:pt-20">
      <title>{`${title} · Aurelle`}</title>
      <div className="w-full max-w-[26rem]">
        <h1 className="display text-4xl sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-3 text-ink-2">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-8 border-t border-line pt-6 text-sm text-ink-2">{footer}</div>}
      </div>
    </div>
  );
}

/** Only allow in-app redirects (blocks //evil.com and absolute URLs). */
export function safeNext(next: string | null, fallback = "/") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

/** Copy server field errors (e.g. "email") onto a react-hook-form instance. */
export function applyServerErrors<T extends Record<string, unknown>>(
  errors: { path: string; message: string }[],
  setError: (name: never, e: { message: string }) => void,
  fields: (keyof T)[],
) {
  let applied = false;
  for (const e of errors) {
    if (fields.includes(e.path as keyof T)) {
      setError(e.path as never, { message: e.message });
      applied = true;
    }
  }
  return applied;
}
