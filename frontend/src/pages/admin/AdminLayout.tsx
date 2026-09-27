import { Suspense } from "react";
import { Link, NavLink, Outlet, ScrollRestoration, useNavigate } from "react-router";
import { LayoutDashboard, LogOut, Moon, Package, ReceiptText, Store, Sun, Tags, Users } from "lucide-react";
import { useAuth } from "../../providers/AuthProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { cn } from "../../lib/cn";
import { Spinner } from "../../components/ui/Feedback";
import { Wordmark } from "../../components/layout/Header";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/orders", label: "Orders", icon: ReceiptText },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/categories", label: "Categories", icon: Tags },
  { to: "/admin/customers", label: "Customers", icon: Users },
];

/** The admin shares the store's tokens but is denser: grotesk only, smaller type, tables. */
export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const signOut = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-dvh bg-bg text-[0.9375rem] lg:grid lg:grid-cols-[14.5rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface lg:flex">
        <Link to="/admin" className="flex items-baseline gap-2 px-5 pt-6 pb-8">
          <Wordmark className="text-[1.5rem]" />
          <span className="text-xs text-muted">Admin</span>
        </Link>
        <nav aria-label="Admin" className="flex flex-col gap-0.5 px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cn("flex items-center gap-3 rounded-lg px-3 py-2 transition-colors", isActive ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-0.5 border-t border-line p-3">
          <Link to="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-ink-2 hover:bg-surface-2 hover:text-ink">
            <Store className="size-4" aria-hidden /> View store
          </Link>
          <button type="button" onClick={toggle} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-ink-2 hover:bg-surface-2 hover:text-ink">
            {theme === "dark" ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button type="button" onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-ink-2 hover:bg-surface-2 hover:text-ink">
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
          <p className="truncate px-3 pt-2 text-xs text-muted">{user?.email}</p>
        </div>
      </aside>

      {/* Phones and tablets: compact top bar with scrollable tabs */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/admin" className="flex items-baseline gap-2">
            <Wordmark className="text-[1.35rem]" />
            <span className="text-xs text-muted">Admin</span>
          </Link>
          <div className="flex items-center gap-1">
            <button type="button" onClick={toggle} className="grid size-10 place-items-center rounded-full hover:bg-surface-2" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
              {theme === "dark" ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
            </button>
            <Link to="/" className="grid size-10 place-items-center rounded-full hover:bg-surface-2" aria-label="View store">
              <Store className="size-4" aria-hidden />
            </Link>
            <button type="button" onClick={signOut} className="grid size-10 place-items-center rounded-full hover:bg-surface-2" aria-label="Sign out">
              <LogOut className="size-4" aria-hidden />
            </button>
          </div>
        </div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
          {NAV.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cn("shrink-0 rounded-full px-3 py-1.5 text-sm", isActive ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2")}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="main" className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </main>
      <ScrollRestoration />
    </div>
  );
}
