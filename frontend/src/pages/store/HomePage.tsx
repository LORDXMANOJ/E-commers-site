import { Link } from "react-router";
import { ArrowUpRight } from "lucide-react";
import { useCategories, useProducts } from "../../hooks/queries";
import { sized, srcSet } from "../../lib/image";
import { ButtonLink } from "../../components/ui/Button";
import { ErrorState, Skeleton } from "../../components/ui/Feedback";
import { ProductCard, ProductCardSkeleton, ProductGrid } from "../../components/product/ProductCard";

const HERO_MAIN = "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=1600&q=80";
const HERO_SIDE = "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=900&q=80";

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="container-page pt-6 sm:pt-8">
      {/* The masthead: the wordmark set at full measure, the one loud element on the page. */}
      <h1 id="hero-title" className="display select-none text-center text-[clamp(3rem,28vw,26rem)] leading-[0.8] font-medium tracking-[-0.045em] motion-safe:animate-[rise_900ms_var(--ease-out)_both]">
        Aurelle
      </h1>

      <div className="mt-5 grid gap-4 sm:mt-7 md:grid-cols-12 md:gap-6">
        <figure className="relative md:col-span-7">
          <img
            src={sized(HERO_MAIN, 1200)}
            srcSet={srcSet(HERO_MAIN, [640, 900, 1200, 1600])}
            sizes="(min-width: 768px) 58vw, 100vw"
            alt="A woman in a camel wrap coat walking down stone steps"
            fetchPriority="high"
            className="aspect-[4/5] w-full rounded-[var(--radius-img)] bg-surface-2 object-cover sm:aspect-[5/4] md:aspect-[4/5] lg:aspect-[6/7]"
          />
          <figcaption className="absolute bottom-3 left-3 rounded-full bg-bg/85 px-3 py-1 text-xs backdrop-blur">
            Camel Wrap Coat, <span className="num">₹12,990</span>
          </figcaption>
        </figure>

        <div className="flex flex-col justify-between gap-8 md:col-span-5">
          <div className="max-w-md pt-2 md:pt-4">
            <p className="display text-[clamp(2.1rem,3.6vw,3.3rem)] leading-[1.02]">Clothes cut to be kept.</p>
            <p className="mt-5 text-ink-2 md:text-lg md:leading-relaxed">
              Coats, knits and leather goods in natural fibres. Made in small runs, priced honestly, and built to be worn for years.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink to="/shop?sort=newest" size="lg">
                Shop new arrivals
              </ButtonLink>
              <ButtonLink to="/shop?sort=popular" variant="secondary" size="lg">
                Best sellers
              </ButtonLink>
            </div>
          </div>
          <img
            src={sized(HERO_SIDE, 700)}
            srcSet={srcSet(HERO_SIDE, [400, 700, 900])}
            sizes="(min-width: 768px) 40vw, 100vw"
            alt="A woman in a navy tartan overcoat on a city street"
            className="hidden aspect-[4/3] w-full rounded-[var(--radius-img)] bg-surface-2 object-cover object-[50%_30%] md:block"
          />
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ id, title, to, linkLabel }: { id: string; title: string; to: string; linkLabel: string }) {
  return (
    <div className="mb-7 flex items-end justify-between gap-4 border-b border-line pb-4">
      <h2 id={id} className="display text-3xl sm:text-4xl">
        {title}
      </h2>
      <Link to={to} className="link-underline inline-flex shrink-0 items-center gap-1 pb-1 text-sm">
        {linkLabel}
        <ArrowUpRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

function Categories() {
  const { data, isPending, isError, refetch } = useCategories();
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  const cats = (data ?? []).filter((c) => c.productCount > 0);
  if (!isPending && cats.length === 0) return null;
  return (
    <section aria-labelledby="cats-title" className="container-page mt-20 sm:mt-28">
      <SectionHeader id="cats-title" title="Shop by category" to="/shop" linkLabel="Everything" />
      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 lg:grid-cols-6">
        {isPending
          ? Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="w-[42vw] shrink-0 sm:w-auto">
                <Skeleton className="aspect-[3/4] w-full" />
                <Skeleton className="mt-3 h-4 w-2/3" />
              </li>
            ))
          : cats.map((c) => (
              <li key={c.id} className="w-[42vw] shrink-0 snap-start sm:w-auto">
                <Link to={`/shop?category=${c.slug}`} className="group block">
                  <div className="aspect-[3/4] overflow-hidden rounded-[var(--radius-img)] bg-surface-2">
                    {c.imageUrl && (
                      <img
                        src={sized(c.imageUrl, 480)}
                        srcSet={srcSet(c.imageUrl, [320, 480, 640])}
                        sizes="(min-width: 1024px) 16vw, (min-width: 640px) 33vw, 42vw"
                        alt=""
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-700 ease-[var(--ease-out)] motion-safe:group-hover:scale-[1.03]"
                      />
                    )}
                  </div>
                  <p className="mt-3 flex items-baseline justify-between gap-2">
                    <span className="font-medium">{c.name}</span>
                    <span className="num text-xs text-muted">{c.productCount}</span>
                  </p>
                </Link>
              </li>
            ))}
      </ul>
    </section>
  );
}

function ProductRail({ id, title, sort, to }: { id: string; title: string; sort: "newest" | "popular"; to: string }) {
  const { data, isPending, isError, refetch } = useProducts({ sort, limit: 4, inStock: true });
  if (!isPending && !isError && data.items.length === 0) return null;
  return (
    <section aria-labelledby={id} className="container-page mt-20 sm:mt-28">
      <SectionHeader id={id} title={title} to={to} linkLabel="View all" />
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <ProductGrid>
          {isPending ? Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />) : data.items.map((p) => <ProductCard key={p.id} product={p} />)}
        </ProductGrid>
      )}
    </section>
  );
}

function Assurances() {
  const points = [
    ["Free shipping over ₹2,999", "Standard delivery in 4–6 business days, or express in 1–2."],
    ["Pay when it arrives", "Cash on delivery across India. No card needed."],
    ["Change your mind", "Cancel any order yourself until we confirm it."],
  ];
  return (
    <section aria-label="Shipping and payment" className="container-page mt-20 sm:mt-28">
      <div className="grid gap-8 border-y border-line py-10 sm:grid-cols-3">
        {points.map(([title, body]) => (
          <div key={title}>
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1.5 text-sm text-muted">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  const all = useProducts({ limit: 1 });
  const empty = all.data?.total === 0;
  return (
    <>
      <title>Aurelle · Clothing & accessories</title>
      <Hero />
      {empty ? (
        <p className="container-page mt-16 text-center text-muted">The collection is being prepared. New pieces will appear here soon.</p>
      ) : (
        <>
          <Categories />
          <ProductRail id="new-title" title="New arrivals" sort="newest" to="/shop?sort=newest" />
          <ProductRail id="best-title" title="Best sellers" sort="popular" to="/shop?sort=popular" />
        </>
      )}
      <Assurances />
    </>
  );
}
