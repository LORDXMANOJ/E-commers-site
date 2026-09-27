import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";

/** Compact page list: 1 … 4 5 6 … 12 */
function pageList(page: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

export function Pagination({ page, totalPages, onChange, className }: { page: number; totalPages: number; onChange: (p: number) => void; className?: string }) {
  if (totalPages <= 1) return null;
  const item = "grid h-10 min-w-10 place-items-center rounded-[var(--radius-ctl)] px-2 text-sm num transition-colors";
  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-center gap-1", className)}>
      <button type="button" className={cn(item, "hover:bg-surface-2 disabled:opacity-30")} onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      {pageList(page, totalPages).map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-muted" aria-hidden>
            …
          </span>
        ) : (
          <button
            type="button"
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(item, p === page ? "bg-ink text-bg" : "hover:bg-surface-2")}
          >
            {p}
          </button>
        ),
      )}
      <button type="button" className={cn(item, "hover:bg-surface-2 disabled:opacity-30")} onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="Next page">
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </nav>
  );
}
