import { cn } from "../../lib/cn";
import { STATUS_LABEL } from "../../lib/format";
import type { OrderStatus } from "../../lib/types";

const tone: Record<OrderStatus, string> = {
  PENDING: "bg-warn-soft text-warn",
  CONFIRMED: "bg-accent-soft text-accent",
  SHIPPED: "bg-accent-soft text-accent",
  DELIVERED: "bg-success-soft text-success",
  CANCELLED: "bg-surface-2 text-muted",
};

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium", tone[status], className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}
