import { useState } from "react";
import { formatINR, formatINRCompact } from "../../lib/format";

type Point = { date: string; revenuePaise: number; orders: number };

const dayFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const weekdayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Rounds the axis max up to a friendly number (1, 2, 2.5, 5 × 10ⁿ). */
function niceMax(v: number) {
  if (v <= 0) return 100_00;
  const exp = 10 ** Math.floor(Math.log10(v));
  const f = v / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
}

/**
 * 14-day revenue bars. Single series, so no legend: the title names it. Thin bars with 4px rounded
 * tops anchored to the baseline, recessive grid, per-bar hover/focus tooltip and a table for
 * screen readers. The colour token (--chart) is validated for both themes.
 */
export function SalesChart({ data }: { data: Point[] }) {
  const [active, setActive] = useState<number | null>(null);
  const W = 640;
  const H = 200;
  const pad = { top: 12, right: 8, bottom: 26, left: 52 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = niceMax(Math.max(...data.map((d) => d.revenuePaise)));
  const slot = innerW / data.length;
  const barW = Math.min(28, slot - 6);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const total = data.reduce((s, d) => s + d.revenuePaise, 0);
  const a = active !== null ? data[active] : null;

  return (
    <figure className="relative">
      <figcaption className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">Revenue, last 14 days</span>
        <span className="num text-sm text-muted">{formatINR(total)} total</span>
      </figcaption>

      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-label={`Daily revenue for the last 14 days, ${formatINR(total)} in total. Table follows.`} onMouseLeave={() => setActive(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} strokeDasharray={t === 0 ? undefined : "2 4"} />
              <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="num fill-muted text-[11px]">
                {formatINRCompact(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = pad.left + i * slot + (slot - barW) / 2;
            const h = Math.max(0, pad.top + innerH - y(d.revenuePaise));
            const r = Math.min(4, h);
            const top = pad.top + innerH - h;
            return (
              <g key={d.date}>
                {/* Hit target: the whole column, larger than the bar */}
                <rect
                  x={pad.left + i * slot}
                  y={pad.top}
                  width={slot}
                  height={innerH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${weekdayFmt.format(new Date(d.date))}: ${formatINR(d.revenuePaise)}, ${d.orders} orders`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="cursor-default outline-none"
                />
                {h > 0 && (
                  <path
                    d={`M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + h} Z`}
                    fill="var(--chart)"
                    opacity={active === null || active === i ? 1 : 0.45}
                    className="pointer-events-none transition-opacity duration-150"
                  />
                )}
                {(i % 2 === 0 || i === data.length - 1) && (
                  <text x={pad.left + i * slot + slot / 2} y={H - 6} textAnchor="middle" className="num fill-muted text-[11px]">
                    {dayFmt.format(new Date(d.date))}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {a && active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 w-max -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-[var(--shadow-pop)]"
            style={{ left: `${((pad.left + active * slot + slot / 2) / W) * 100}%` }}
          >
            <p className="text-xs text-muted">{weekdayFmt.format(new Date(a.date))}</p>
            <p className="num font-semibold">{formatINR(a.revenuePaise)}</p>
            <p className="num text-xs text-muted">{a.orders} {a.orders === 1 ? "order" : "orders"}</p>
          </div>
        )}
      </div>

      <table className="sr-only">
        <caption>Daily revenue</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Revenue</th>
            <th>Orders</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{dayFmt.format(new Date(d.date))}</td>
              <td>{formatINR(d.revenuePaise)}</td>
              <td>{d.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
