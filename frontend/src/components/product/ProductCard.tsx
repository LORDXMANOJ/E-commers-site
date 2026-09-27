import { Link } from "react-router";
import { cn } from "../../lib/cn";
import { sized, srcSet } from "../../lib/image";
import type { Product } from "../../lib/types";
import { Price } from "../ui/Price";
import { Skeleton } from "../ui/Feedback";

const LOW_STOCK = 5;

/** If an image fails (offline, CDN hiccup), fall back to the neutral surface instead of a broken icon. */
const hideOnError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.visibility = "hidden";
};

export function StockNote({ stock, className }: { stock: number; className?: string }) {
  if (stock <= 0) return <p className={cn("text-xs font-medium text-muted", className)}>Sold out</p>;
  if (stock <= LOW_STOCK) return <p className={cn("text-xs font-medium text-sale", className)}>Only {stock} left</p>;
  return null;
}

export function ProductCard({ product, priority, sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" }: { product: Product; priority?: boolean; sizes?: string }) {
  const [a, b] = product.images;
  const soldOut = product.stock <= 0;
  return (
    <article className="group relative">
      <Link to={`/product/${product.slug}`} className="hover-swap block focus-visible:outline-offset-4">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-img)] bg-surface-2">
          {a && (
            <img
              src={sized(a, 640)}
              srcSet={srcSet(a)}
              sizes={sizes}
              alt={product.name}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : undefined}
              decoding="async"
              onError={hideOnError}
              className={cn("absolute inset-0 size-full object-cover transition-transform duration-700 ease-[var(--ease-out)] motion-safe:group-hover:scale-[1.025]", soldOut && "opacity-60 grayscale-[35%]")}
            />
          )}
          {b && (
            <img
              src={sized(b, 640)}
              srcSet={srcSet(b)}
              sizes={sizes}
              alt=""
              loading="lazy"
              decoding="async"
              onError={hideOnError}
              className="hover-swap-b absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-500"
            />
          )}
          {soldOut && (
            <span className="absolute top-3 left-3 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-medium backdrop-blur">Sold out</span>
          )}
        </div>
        <div className="mt-3 flex flex-col gap-0.5">
          <h3 className="text-[0.95rem] leading-snug font-medium text-ink">{product.name}</h3>
          <p className="text-xs text-muted">{product.category.name}</p>
          <Price pricePaise={product.pricePaise} compareAtPaise={product.compareAtPaise} size="sm" className="mt-1" />
          {!soldOut && <StockNote stock={product.stock} />}
        </div>
      </Link>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-[4/5] w-full" />
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/3" />
      <Skeleton className="mt-2 h-4 w-1/4" />
    </div>
  );
}

export function ProductGrid({ children, className, cols = 4 }: { children: React.ReactNode; className?: string; cols?: 3 | 4 }) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-3 gap-y-9 sm:grid-cols-3 sm:gap-x-5 lg:gap-x-6 lg:gap-y-12", cols === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3", className)}>
      {children}
    </div>
  );
}
