import { cn } from "../../lib/cn";
import { discountPercent, formatINR } from "../../lib/format";

export function Price({
  pricePaise,
  compareAtPaise,
  className,
  size = "md",
}: {
  pricePaise: number;
  compareAtPaise?: number | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const off = discountPercent(pricePaise, compareAtPaise ?? null);
  return (
    <p className={cn("num flex flex-wrap items-baseline gap-x-2", className)}>
      <span className={cn("font-medium", size === "lg" && "text-xl", size === "sm" && "text-sm", off > 0 && "text-sale")}>
        <span className="sr-only">{off > 0 ? "Sale price " : "Price "}</span>
        {formatINR(pricePaise)}
      </span>
      {off > 0 && compareAtPaise && (
        <>
          <s className={cn("text-muted", size === "lg" ? "text-base" : "text-sm")}>
            <span className="sr-only">Was </span>
            {formatINR(compareAtPaise)}
          </s>
          <span className={cn("text-sale", size === "lg" ? "text-sm" : "text-xs")}>{off}% off</span>
        </>
      )}
    </p>
  );
}
