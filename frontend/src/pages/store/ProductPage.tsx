import { useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { Check, Package, RotateCcw, Truck } from "lucide-react";
import { useProduct, useRelated } from "../../hooks/queries";
import { useCart } from "../../providers/CartProvider";
import { ApiError } from "../../lib/api";
import { cn } from "../../lib/cn";
import { sized, srcSet } from "../../lib/image";
import type { Product } from "../../lib/types";
import { Price } from "../../components/ui/Price";
import { Button } from "../../components/ui/Button";
import { QuantityStepper } from "../../components/ui/QuantityStepper";
import { ErrorState, Skeleton } from "../../components/ui/Feedback";
import { ProductCard, ProductGrid } from "../../components/product/ProductCard";
import { NotFound } from "../../components/NotFound";

function Gallery({ product }: { product: Product }) {
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const images = product.images.length ? product.images : [""];

  return (
    <div>
      {/* Phones and tablets: swipeable carousel */}
      <div className="relative -mx-4 lg:hidden">
        <div
          ref={track}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}
          aria-roledescription="carousel"
          aria-label={`${product.name} images`}
        >
          {images.map((src, i) => (
            <div key={i} className="w-full shrink-0 snap-center" aria-roledescription="slide" aria-label={`${i + 1} of ${images.length}`}>
              <img
                src={src ? sized(src, 900) : undefined}
                srcSet={src ? srcSet(src) : undefined}
                sizes="100vw"
                alt={i === 0 ? product.name : `${product.name}, view ${i + 1}`}
                fetchPriority={i === 0 ? "high" : undefined}
                loading={i === 0 ? "eager" : "lazy"}
                className="aspect-[4/5] w-full bg-surface-2 object-cover sm:aspect-[5/4]"
              />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-bg/80 px-2.5 py-1.5 backdrop-blur">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Show image ${i + 1}`}
                aria-current={i === index}
                onClick={() => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: "smooth" })}
                className={cn("size-1.5 rounded-full transition-colors", i === index ? "bg-ink" : "bg-line-strong")}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: editorial stack. The first image spans both columns when the rest pair up evenly. */}
      <div className="hidden gap-3 lg:grid lg:grid-cols-2">
        {images.map((src, i) => {
          const hero = i === 0 && (images.length - 1) % 2 === 0;
          return (
          <img
            key={i}
            src={src ? sized(src, 1200) : undefined}
            srcSet={src ? srcSet(src) : undefined}
            sizes={hero ? "55vw" : "28vw"}
            alt={i === 0 ? product.name : `${product.name}, view ${i + 1}`}
            fetchPriority={i === 0 ? "high" : undefined}
            className={cn("aspect-[4/5] w-full rounded-[var(--radius-img)] bg-surface-2 object-cover", hero && "col-span-2")}
          />
          );
        })}
      </div>
    </div>
  );
}

function StockStatus({ stock }: { stock: number }) {
  if (stock <= 0) return <p className="font-medium text-muted">Sold out</p>;
  if (stock <= 5)
    return (
      <p className="flex items-center gap-2 font-medium text-sale">
        <span className="size-2 rounded-full bg-current" aria-hidden />
        Only {stock} left
      </p>
    );
  return (
    <p className="flex items-center gap-2 font-medium text-success">
      <Check className="size-4" aria-hidden /> In stock, ready to ship
    </p>
  );
}

function PurchasePanel({ product }: { product: Product }) {
  const cart = useCart();
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const inBag = cart.lines.find((l) => l.productId === product.id)?.quantity ?? 0;
  const maxAddable = Math.max(0, Math.min(product.stock - inBag, 20));
  const soldOut = product.stock <= 0;

  const add = async () => {
    setAdding(true);
    const ok = await cart.add(product, qty);
    setAdding(false);
    if (ok) {
      toast.success(`${product.name} added to your bag`, { action: { label: "View bag", onClick: cart.openDrawer } });
      setQty(1);
    }
  };

  return (
    <div className="lg:sticky lg:top-28">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link to="/shop" className="hover:text-ink">Shop</Link>
        <span aria-hidden> / </span>
        <Link to={`/shop?category=${product.category.slug}`} className="hover:text-ink">
          {product.category.name}
        </Link>
      </nav>
      <h1 className="display mt-3 text-4xl sm:text-5xl">{product.name}</h1>
      <Price className="mt-5" size="lg" pricePaise={product.pricePaise} compareAtPaise={product.compareAtPaise} />
      <p className="mt-1 text-xs text-muted">Inclusive of all taxes</p>

      <div className="mt-6 text-sm">
        <StockStatus stock={product.stock} />
      </div>

      {!soldOut && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <QuantityStepper value={Math.min(qty, Math.max(maxAddable, 1))} max={Math.max(maxAddable, 1)} onChange={setQty} disabled={maxAddable === 0} />
          <Button size="lg" className="flex-1" onClick={add} loading={adding} disabled={maxAddable === 0}>
            {maxAddable === 0 ? "All available stock is in your bag" : "Add to bag"}
          </Button>
        </div>
      )}
      {inBag > 0 && (
        <p className="mt-3 text-sm text-muted">
          {inBag} already in your bag.{" "}
          <button type="button" className="link-underline text-ink" onClick={cart.openDrawer}>
            View bag
          </button>
        </p>
      )}

      <div className="measure mt-10 border-t border-line pt-6">
        <h2 className="text-sm font-semibold">Details</h2>
        <p className="mt-2 leading-relaxed whitespace-pre-line text-ink-2">{product.description}</p>
      </div>

      <ul className="mt-8 space-y-3 border-t border-line pt-6 text-sm text-ink-2">
        <li className="flex gap-3"><Truck className="size-4 shrink-0 translate-y-0.5" aria-hidden /> Free standard shipping on orders over ₹2,999</li>
        <li className="flex gap-3"><Package className="size-4 shrink-0 translate-y-0.5" aria-hidden /> Cash on delivery available</li>
        <li className="flex gap-3"><RotateCcw className="size-4 shrink-0 translate-y-0.5" aria-hidden /> Cancel from your account until the order is confirmed</li>
      </ul>
    </div>
  );
}

function Related({ slug }: { slug: string }) {
  const { data } = useRelated(slug);
  if (!data?.length) return null;
  return (
    <section aria-labelledby="related-title" className="mt-24">
      <h2 id="related-title" className="display mb-7 border-b border-line pb-4 text-3xl sm:text-4xl">
        You may also like
      </h2>
      <ProductGrid>
        {data.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </ProductGrid>
    </section>
  );
}

export default function ProductPage() {
  const { slug = "" } = useParams();
  const { data: product, isPending, isError, error, refetch } = useProduct(slug);

  if (isError && error instanceof ApiError && error.status === 404) return <NotFound />;

  return (
    <div className="container-page pt-4 sm:pt-8">
      {isError ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : isPending ? (
        <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-14">
          <Skeleton className="-mx-4 aspect-[4/5] lg:mx-0" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="mt-8 h-12 w-full" />
          </div>
        </div>
      ) : (
        <>
          <title>{`${product.name} · Aurelle`}</title>
          <meta name="description" content={product.description.slice(0, 155)} />
          <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-14">
            <Gallery product={product} />
            <PurchasePanel product={product} />
          </div>
          <Related slug={slug} />
        </>
      )}
    </div>
  );
}
