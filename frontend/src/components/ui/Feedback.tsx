import type { ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "./Button";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-[var(--radius-img)]", className)} />;
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center", className)}>
      {icon && <div className="mb-5 text-muted [&>svg]:size-9 [&>svg]:stroke-[1.25]">{icon}</div>}
      <h2 className="display text-2xl sm:text-3xl">{title}</h2>
      {children && <div className="mt-3 text-muted">{children}</div>}
      {action && <div className="mt-7">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }: { message?: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center", className)}>
      <h2 className="text-lg font-semibold">This didn't load</h2>
      <p className="mt-2 text-muted">{message ?? "Check your connection and try again."}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-6" onClick={onRetry}>
          <RotateCcw className="size-4" aria-hidden /> Try again
        </Button>
      )}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex justify-center py-20">
      <span className="size-6 animate-spin rounded-full border-2 border-line border-t-ink" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
