import { cn } from "../../lib/cn";
import { sizeLabel } from "../../lib/format";
import type { Variant } from "../../lib/types";

/**
 * Size selector as a radio group: arrow keys move between sizes, sold-out sizes stay visible but disabled
 * so shoppers can see the full range.
 */
export function SizePicker({
  variants,
  value,
  onChange,
  invalid,
}: {
  variants: Variant[];
  value: string | null;
  onChange: (variantId: string) => void;
  invalid?: boolean;
}) {
  return (
    <fieldset>
      <legend className="sr-only">Size</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-invalid={invalid || undefined}>
        {variants.map((v) => {
          const soldOut = v.stock <= 0;
          const selected = v.id === value;
          return (
            <label
              key={v.id}
              className={cn(
                "relative inline-flex h-11 min-w-12 cursor-pointer items-center justify-center rounded-[var(--radius-control)] border px-3.5 text-sm font-medium transition-colors select-none",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--accent)]",
                selected ? "border-ink bg-ink text-bg" : "border-line-strong hover:border-ink",
                soldOut && "cursor-not-allowed border-line text-muted line-through decoration-1 hover:border-line",
                invalid && !selected && "border-sale",
              )}
            >
              <input
                type="radio"
                name="size"
                value={v.id}
                checked={selected}
                disabled={soldOut}
                onChange={() => onChange(v.id)}
                className="sr-only"
              />
              {sizeLabel(v.size)}
              {soldOut && <span className="sr-only"> (sold out)</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const GUIDE: [string, string, string, string][] = [
  ["XS", "32", "26", "35"],
  ["S", "34", "28", "37"],
  ["M", "36", "30", "39"],
  ["L", "38", "32", "41"],
  ["XL", "40", "34", "43"],
  ["XXL", "42", "36", "45"],
];

/** Body measurements in inches. Free Size garments (sarees, dupattas) fit most sizes. */
export function SizeGuide() {
  return (
    <details className="group text-sm">
      <summary className="link-underline inline cursor-pointer text-ink-2 marker:content-none">Size guide</summary>
      <div className="mt-3 overflow-x-auto rounded-[var(--radius-control)] border border-line">
        <table className="num w-full text-left">
          <caption className="sr-only">Body measurements in inches</caption>
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Size</th>
              <th scope="col" className="px-3 py-2 font-medium">Bust</th>
              <th scope="col" className="px-3 py-2 font-medium">Waist</th>
              <th scope="col" className="px-3 py-2 font-medium">Hip</th>
            </tr>
          </thead>
          <tbody>
            {GUIDE.map(([s, bust, waist, hip]) => (
              <tr key={s} className="border-t border-line">
                <th scope="row" className="px-3 py-2 font-medium">{s}</th>
                <td className="px-3 py-2">{bust}″</td>
                <td className="px-3 py-2">{waist}″</td>
                <td className="px-3 py-2">{hip}″</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-line px-3 py-2 text-xs text-muted">
          Measurements are of the body, not the garment. Free Size pieces such as sarees and dupattas fit most sizes.
        </p>
      </div>
    </details>
  );
}
