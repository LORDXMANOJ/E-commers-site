import { cn } from "../../lib/cn";
import { SIZES, sizeLabel } from "../../lib/format";
import type { Size } from "../../lib/types";

export type SizeRows = Record<Size, { on: boolean; stock: string }>;

const GARMENT_SIZES = SIZES.filter((s) => s !== "FREE_SIZE");

export function emptySizeRows(): SizeRows {
  return Object.fromEntries(SIZES.map((s) => [s, { on: false, stock: "0" }])) as SizeRows;
}

export function sizeRowsFrom(variants: { size: Size; stock: number }[]): SizeRows {
  const rows = emptySizeRows();
  for (const v of variants) rows[v.size] = { on: true, stock: String(v.stock) };
  return rows;
}

/** Validates the editor and returns the API payload, or an error message. */
export function sizeRowsToVariants(rows: SizeRows, freeSize: boolean): { variants?: { size: Size; stock: number }[]; error?: string } {
  const chosen = freeSize ? (["FREE_SIZE"] as Size[]) : GARMENT_SIZES.filter((s) => rows[s].on);
  if (chosen.length === 0) return { error: "Choose at least one size" };
  for (const s of chosen) {
    if (!/^\d{1,7}$/.test(rows[s].stock.trim())) return { error: `Enter a whole number for ${sizeLabel(s)}` };
  }
  return { variants: chosen.map((s) => ({ size: s, stock: Number(rows[s].stock) })) };
}

/**
 * Stock per size. "Free Size" (sarees, dupattas, stoles) is one stock count; garments list each size
 * they come in. Sizes left unticked are removed from the product (and from shoppers' bags).
 */
export function SizeStockEditor({
  rows,
  onChange,
  freeSize,
  onFreeSizeChange,
  error,
}: {
  rows: SizeRows;
  onChange: (rows: SizeRows) => void;
  freeSize: boolean;
  onFreeSizeChange: (v: boolean) => void;
  error?: string;
}) {
  const set = (s: Size, patch: Partial<SizeRows[Size]>) => onChange({ ...rows, [s]: { ...rows[s], ...patch } });
  const total = (freeSize ? ["FREE_SIZE" as Size] : GARMENT_SIZES.filter((s) => rows[s].on)).reduce(
    (n, s) => n + (Number(rows[s].stock) || 0),
    0,
  );

  return (
    <fieldset aria-describedby={error ? "sizes-error" : undefined}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <legend className="font-medium">Sizes and stock</legend>
        <p className="num text-sm text-muted">Total in stock: {total}</p>
      </div>

      <div className="mt-4 inline-flex rounded-[var(--radius-control)] border border-line-strong p-1 text-sm" role="radiogroup" aria-label="Sizing">
        {[
          { v: false, label: "Garment sizes" },
          { v: true, label: "Free Size" },
        ].map((o) => (
          <label
            key={o.label}
            className={cn(
              "cursor-pointer rounded-[calc(var(--radius-control)-4px)] px-3 py-1.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--accent)]",
              freeSize === o.v ? "bg-ink text-bg" : "text-ink-2 hover:text-ink",
            )}
          >
            <input type="radio" name="sizing" className="sr-only" checked={freeSize === o.v} onChange={() => onFreeSizeChange(o.v)} />
            {o.label}
          </label>
        ))}
      </div>

      {freeSize ? (
        <label className="mt-4 flex max-w-48 flex-col gap-1.5 text-sm">
          <span className="text-ink-2">Free Size stock</span>
          <input
            inputMode="numeric"
            value={rows.FREE_SIZE.stock}
            onChange={(e) => set("FREE_SIZE", { stock: e.target.value, on: true })}
            className="num h-11 rounded-[var(--radius-control)] border border-line-strong bg-bg px-3"
          />
        </label>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {GARMENT_SIZES.map((s) => {
            const r = rows[s];
            return (
              <div
                key={s}
                className={cn(
                  "flex items-center gap-3 rounded-[var(--radius-control)] border p-2.5 transition-colors",
                  r.on ? "border-ink" : "border-line",
                )}
              >
                <label className="flex min-w-14 cursor-pointer items-center gap-2 font-medium">
                  <input type="checkbox" checked={r.on} onChange={(e) => set(s, { on: e.target.checked })} className="size-4 accent-[var(--accent)]" />
                  {s}
                </label>
                <input
                  aria-label={`Stock for size ${s}`}
                  inputMode="numeric"
                  value={r.stock}
                  disabled={!r.on}
                  onChange={(e) => set(s, { stock: e.target.value })}
                  className="num h-9 w-full min-w-0 rounded-[calc(var(--radius-control)-2px)] border border-line-strong bg-bg px-2 text-right disabled:opacity-40"
                />
              </div>
            );
          })}
        </div>
      )}
      {error && (
        <p id="sizes-error" role="alert" className="mt-2 text-sm text-sale">
          {error}
        </p>
      )}
    </fieldset>
  );
}
