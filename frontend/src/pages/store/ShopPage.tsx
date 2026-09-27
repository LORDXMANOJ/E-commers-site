import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { SearchX, SlidersHorizontal, X } from "lucide-react";
import { useCategories, useProducts, type ProductQuery } from "../../hooks/queries";
import { cn } from "../../lib/cn";
import { formatINR, plural } from "../../lib/format";
import { ProductCard, ProductCardSkeleton, ProductGrid } from "../../components/product/ProductCard";
import { EmptyState, ErrorState } from "../../components/ui/Feedback";
import { Pagination } from "../../components/ui/Pagination";
import { Sheet } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/Button";
import { controlClass, selectArrow } from "../../components/ui/Field";

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most popular" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
] as const;

const PRICE_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: "Under ₹2,000", max: 2000 },
  { label: "₹2,000 – ₹5,000", min: 2000, max: 5000 },
  { label: "₹5,000 – ₹10,000", min: 5000, max: 10000 },
  { label: "Over ₹10,000", min: 10000 },
];

const PAGE_SIZE = 12;
const intParam = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

/** Filter state lives in the URL, so results are shareable and survive refresh/back. */
function useFilters() {
  const [params, setParams] = useSearchParams();
  const sortParam = params.get("sort");
  const filters = {
    q: params.get("q")?.trim() || undefined,
    category: params.get("category") || undefined,
    min: intParam(params.get("min")),
    max: intParam(params.get("max")),
    inStock: params.get("inStock") === "1",
    sort: (SORTS.some((s) => s.value === sortParam) ? sortParam : "newest") as NonNullable<ProductQuery["sort"]>,
    page: Math.max(1, intParam(params.get("page")) ?? 1),
  };
  const update = (patch: Partial<Record<"q" | "category" | "min" | "max" | "inStock" | "sort" | "page", string | number | boolean | undefined>>) => {
    setParams(
      () => {
        // Read the live URL: the updater's `prev` can be one render stale when filters change quickly.
        const next = new URLSearchParams(window.location.search);
        for (const [k, v] of Object.entries(patch)) {
          if (v === undefined || v === "" || v === false) next.delete(k);
          else next.set(k, v === true ? "1" : String(v));
        }
        if (!("page" in patch)) next.delete("page"); // any filter change resets to page 1
        return next;
      },
      { preventScrollReset: true },
    );
  };
  return { filters, update, clear: () => setParams(filters.q ? { q: filters.q } : {}) };
}

function PriceRange({ min, max, onApply }: { min?: number; max?: number; onApply: (min?: number, max?: number) => void }) {
  const [lo, setLo] = useState(min?.toString() ?? "");
  const [hi, setHi] = useState(max?.toString() ?? "");
  useEffect(() => {
    setLo(min?.toString() ?? "");
    setHi(max?.toString() ?? "");
  }, [min, max]);
  const apply = () => {
    let a = lo ? Number(lo) : undefined;
    let b = hi ? Number(hi) : undefined;
    if (a !== undefined && b !== undefined && a > b) [a, b] = [b, a];
    onApply(a, b);
  };
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      {[
        ["Min ₹", lo, setLo],
        ["Max ₹", hi, setHi],
      ].map(([label, value, set]) => (
        <label key={label as string} className="flex-1 text-xs text-muted">
          {label as string}
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={value as string}
            onChange={(e) => (set as (v: string) => void)(e.target.value.replace(/\D/g, "").slice(0, 7))}
            onBlur={apply}
            className={cn(controlClass, "num mt-1 h-10 px-2.5")}
          />
        </label>
      ))}
      <button type="submit" className="sr-only">
        Apply price
      </button>
    </form>
  );
}

type FilterApi = ReturnType<typeof useFilters>;

function FilterPanel({ f, update }: { f: FilterApi["filters"]; update: FilterApi["update"] }) {
  const { data: categories } = useCategories();
  const radio = "flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[0.95rem] transition-colors hover:bg-surface-2";
  return (
    <div className="space-y-9">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Category</legend>
        <ul className="-mx-2">
          <li>
            <button type="button" className={cn(radio, !f.category && "font-semibold")} aria-pressed={!f.category} onClick={() => update({ category: undefined })}>
              All categories
            </button>
          </li>
          {(categories ?? []).map((c) => (
            <li key={c.id}>
              <button type="button" className={cn(radio, f.category === c.slug && "font-semibold")} aria-pressed={f.category === c.slug} onClick={() => update({ category: c.slug })}>
                {c.name}
                <span className="num text-xs font-normal text-muted">{c.productCount}</span>
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold">Price</legend>
        <div className="mb-3 flex flex-wrap gap-2">
          {PRICE_PRESETS.map((p) => {
            const active = f.min === p.min && f.max === p.max;
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={active}
                onClick={() => update(active ? { min: undefined, max: undefined } : { min: p.min, max: p.max })}
                className={cn("num rounded-full border px-3 py-1.5 text-sm transition-colors", active ? "border-ink bg-ink text-bg" : "border-line-strong hover:border-ink")}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <PriceRange min={f.min} max={f.max} onApply={(min, max) => update({ min, max })} />
      </fieldset>

      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="text-sm font-semibold">In stock only</span>
        <input type="checkbox" checked={f.inStock} onChange={(e) => update({ inStock: e.target.checked })} className="size-5 accent-[var(--accent)]" />
      </label>
    </div>
  );
}

export default function ShopPage() {
  const { filters: f, update, clear } = useFilters();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data: categories } = useCategories();
  const query: ProductQuery = {
    q: f.q,
    category: f.category,
    minPrice: f.min !== undefined ? f.min * 100 : undefined,
    maxPrice: f.max !== undefined ? f.max * 100 : undefined,
    inStock: f.inStock || undefined,
    sort: f.sort,
    page: f.page,
    limit: PAGE_SIZE,
  };
  const { data, isPending, isError, isFetching, refetch } = useProducts(query);

  const category = categories?.find((c) => c.slug === f.category);
  const title = f.q ? `Results for “${f.q}”` : (category?.name ?? "All products");

  const chips: { label: string; clear: () => void }[] = [];
  if (f.q) chips.push({ label: `“${f.q}”`, clear: () => update({ q: undefined }) });
  if (category) chips.push({ label: category.name, clear: () => update({ category: undefined }) });
  if (f.min !== undefined || f.max !== undefined)
    chips.push({
      label: f.min !== undefined && f.max !== undefined ? `${formatINR(f.min * 100)} – ${formatINR(f.max * 100)}` : f.min !== undefined ? `Over ${formatINR(f.min * 100)}` : `Under ${formatINR(f.max! * 100)}`,
      clear: () => update({ min: undefined, max: undefined }),
    });
  if (f.inStock) chips.push({ label: "In stock", clear: () => update({ inStock: undefined }) });

  const goToPage = (page: number) => {
    update({ page: page > 1 ? page : undefined });
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return (
    <div className="container-page pt-8 sm:pt-12">
      <title>{`${title} · Aurelle`}</title>
      <header className="border-b border-line pb-6">
        <h1 className="display text-4xl sm:text-5xl">{title}</h1>
        {category?.description && !f.q && <p className="measure mt-3 text-ink-2">{category.description}</p>}
      </header>

      <div className="sticky top-16 z-20 -mx-4 flex items-center justify-between gap-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-5 lg:backdrop-blur-none">
        <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setSheetOpen(true)}>
          <SlidersHorizontal className="size-4" aria-hidden /> Filters{chips.length ? ` (${chips.length})` : ""}
        </Button>
        <p className="num hidden text-sm text-muted lg:block" aria-live="polite">
          {data ? plural(data.total, "product") : " "}
        </p>
        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
          <span className="hidden text-muted sm:inline">Sort by</span>
          <select
            value={f.sort}
            onChange={(e) => update({ sort: e.target.value === "newest" ? undefined : e.target.value })}
            className={cn(controlClass, selectArrow, "h-10 w-auto appearance-none bg-[length:1rem] bg-[right_0.6rem_center] bg-no-repeat pr-9 text-[16px]")}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-10 pt-6 lg:grid-cols-[15rem_1fr] lg:pt-0">
        <aside aria-label="Filters" className="hidden lg:block">
          <div className="sticky top-28">
            <FilterPanel f={f} update={update} />
          </div>
        </aside>

        <section aria-label="Products" aria-busy={isFetching}>
          {chips.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <button key={c.label} type="button" onClick={c.clear} className="num inline-flex items-center gap-1.5 rounded-full bg-surface-2 py-1.5 pr-2.5 pl-3 text-sm hover:bg-line" aria-label={`Remove filter ${c.label}`}>
                  {c.label}
                  <X className="size-3.5" aria-hidden />
                </button>
              ))}
              <button type="button" onClick={clear} className="link-underline ml-1 text-sm">
                Clear all
              </button>
            </div>
          )}

          {isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : isPending ? (
            <ProductGrid cols={3}>
              {Array.from({ length: 6 }, (_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </ProductGrid>
          ) : data.items.length === 0 ? (
            <EmptyState icon={<SearchX />} title="Nothing matches yet" action={chips.length ? <Button variant="secondary" onClick={clear}>Clear filters</Button> : undefined}>
              {chips.length ? "Try removing a filter or searching for something broader." : "New pieces are on their way. Check back soon."}
            </EmptyState>
          ) : (
            <>
              <ProductGrid cols={3} className={cn("transition-opacity", isFetching && "opacity-60")}>
                {data.items.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 3} sizes="(min-width: 1024px) 27vw, (min-width: 640px) 33vw, 50vw" />
                ))}
              </ProductGrid>
              <Pagination className="mt-14" page={data.page} totalPages={data.totalPages} onChange={goToPage} />
            </>
          )}
        </section>
      </div>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filters"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={clear}>
              Clear all
            </Button>
            <Button onClick={() => setSheetOpen(false)}>{data ? `Show ${plural(data.total, "result")}` : "Show results"}</Button>
          </div>
        }
      >
        <div className="p-5">
          <FilterPanel f={f} update={update} />
        </div>
      </Sheet>
    </div>
  );
}
