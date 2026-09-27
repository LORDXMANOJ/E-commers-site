import { Minus, Plus } from "lucide-react";
import { cn } from "../../lib/cn";

export function QuantityStepper({
  value,
  max,
  min = 1,
  onChange,
  disabled,
  size = "md",
  label = "Quantity",
}: {
  value: number;
  max: number;
  min?: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  label?: string;
}) {
  const btn = cn(
    "grid place-items-center text-ink transition-colors hover:bg-surface-2 disabled:opacity-35 disabled:hover:bg-transparent",
    size === "sm" ? "size-9" : "size-11",
  );
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex items-center rounded-[var(--radius-ctl)] border border-line-strong bg-surface", disabled && "opacity-60")}
    >
      <button type="button" className={cn(btn, "rounded-l-[var(--radius-ctl)]")} onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label="Decrease quantity">
        <Minus className="size-4" aria-hidden />
      </button>
      <output aria-live="polite" className={cn("num text-center font-medium", size === "sm" ? "w-7 text-sm" : "w-9")}>
        {value}
      </output>
      <button type="button" className={cn(btn, "rounded-r-[var(--radius-ctl)]")} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="Increase quantity">
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
