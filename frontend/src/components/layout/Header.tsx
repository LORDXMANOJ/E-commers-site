import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { Menu, Moon, Search, ShoppingBag, Sun, User as UserIcon } from "lucide-react";
import { useCart } from "../../providers/CartProvider";
import { useAuth } from "../../providers/AuthProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { useCategories } from "../../hooks/queries";
import { cn } from "../../lib/cn";
import { Sheet } from "../ui/Dialog";
import { controlClass } from "../ui/Field";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("display text-[1.7rem] leading-none font-semibold tracking-[-0.01em]", className)}>
      Aurelle
    </span>
  );
}

function SearchForm({ onDone, autoFocus, className }: { onDone?: () => void; autoFocus?: boolean; className?: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        navigate(q.trim() ? `/shop?q=${encodeURIComponent(q.trim())}` : "/shop");
        setQ("");
        onDone?.();
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search coats, dresses, bags…"
        aria-label="Search products"
        autoFocus={autoFocus}
        className={cn(controlClass, "h-10 rounded-full pl-9 text-[16px]")}
      />
    </form>
  );
}

function IconButton({ label, onClick, children, badge }: { label: string; onClick?: () => void; children: React.ReactNode; badge?: number }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="relative grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-surface-2">
      {children}
      {badge ? (
        <span className="num absolute top-0.5 right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[11px] leading-none font-semibold text-accent-ink" aria-hidden>
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}

export function Header() {
  const { itemCount, openDrawer } = useCart();
  const { user, isAdmin } = useAuth();
  const { theme, toggle } = useTheme();
  const { data: categories } = useCategories();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname, location.search]);

  const navCats = (categories ?? []).filter((c) => c.productCount > 0).slice(0, 4);
  const navLink = ({ isActive }: { isActive: boolean }) =>
    cn("relative py-2 text-[0.95rem] transition-colors hover:text-ink", isActive ? "text-ink" : "text-ink-2");

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md supports-[backdrop-filter]:bg-bg/75">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-bg">
        Skip to content
      </a>
      <div className="container-page flex h-16 items-center gap-4 lg:h-[4.5rem]">
        <div className="flex items-center lg:hidden">
          <IconButton label="Open menu" onClick={() => setMenuOpen(true)}>
            <Menu className="size-5" aria-hidden />
          </IconButton>
        </div>

        <Link to="/" className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0" aria-label="Aurelle home">
          <Wordmark />
        </Link>

        <nav aria-label="Main" className="ml-10 hidden items-center gap-7 lg:flex">
          <NavLink to="/shop" end className={navLink}>
            Shop all
          </NavLink>
          {navCats.map((c) => (
            <NavLink key={c.id} to={`/shop?category=${c.slug}`} className={() => navLink({ isActive: location.search.includes(`category=${c.slug}`) })}>
              {c.name}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <SearchForm className="mr-2 hidden w-60 xl:block" />
          <div className="hidden sm:block">
            <IconButton label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={toggle}>
              {theme === "dark" ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
            </IconButton>
          </div>
          {isAdmin && (
            <Link to="/admin" className="mr-1 hidden rounded-full border border-line-strong px-3 py-1.5 text-sm hover:border-ink lg:inline-block">
              Admin
            </Link>
          )}
          <Link to={user ? "/account" : "/login"} aria-label={user ? "Your account" : "Sign in"} className="hidden size-10 place-items-center rounded-full hover:bg-surface-2 sm:grid">
            <UserIcon className="size-5" aria-hidden />
          </Link>
          <IconButton label={`Open bag, ${itemCount} ${itemCount === 1 ? "item" : "items"}`} onClick={openDrawer} badge={itemCount}>
            <ShoppingBag className="size-5" aria-hidden />
          </IconButton>
        </div>
      </div>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" variant="full">
        <div className="flex flex-col gap-8 px-5 py-6">
          <SearchForm onDone={() => setMenuOpen(false)} />
          <nav aria-label="Mobile" className="flex flex-col">
            {[{ to: "/shop", label: "Shop all" }, ...(categories ?? []).map((c) => ({ to: `/shop?category=${c.slug}`, label: c.name }))].map((l) => (
              <Link key={l.to} to={l.to} className="display border-b border-line py-3.5 text-[1.9rem]">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-1 text-lg">
            {user ? (
              <>
                <Link to="/account" className="py-2">Your orders</Link>
                <Link to="/account/profile" className="py-2">Profile</Link>
                {isAdmin && <Link to="/admin" className="py-2">Admin panel</Link>}
              </>
            ) : (
              <>
                <Link to="/login" className="py-2">Sign in</Link>
                <Link to="/register" className="py-2">Create an account</Link>
              </>
            )}
            <button type="button" onClick={toggle} className="flex items-center gap-2 py-2 text-left">
              {theme === "dark" ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
          </div>
        </div>
      </Sheet>
    </header>
  );
}
