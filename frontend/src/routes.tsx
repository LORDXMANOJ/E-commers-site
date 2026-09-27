import { lazy, type ReactNode } from "react";
import { createBrowserRouter, Navigate, useLocation } from "react-router";
import { StoreLayout } from "./components/layout/StoreLayout";
import { useAuth } from "./providers/AuthProvider";
import { Spinner, EmptyState } from "./components/ui/Feedback";
import { ButtonLink } from "./components/ui/Button";
import { NotFound } from "./components/NotFound";

// Route pages are code-split so the initial bundle stays small.
const HomePage = lazy(() => import("./pages/store/HomePage"));
const ShopPage = lazy(() => import("./pages/store/ShopPage"));
const ProductPage = lazy(() => import("./pages/store/ProductPage"));
const CartPage = lazy(() => import("./pages/store/CartPage"));
const CheckoutPage = lazy(() => import("./pages/store/CheckoutPage"));
const OrderPlacedPage = lazy(() => import("./pages/store/OrderPlacedPage"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage"));
const AccountLayout = lazy(() => import("./pages/account/AccountLayout"));
const OrdersPage = lazy(() => import("./pages/account/OrdersPage"));
const OrderDetailPage = lazy(() => import("./pages/account/OrderDetailPage"));
const ProfilePage = lazy(() => import("./pages/account/ProfilePage"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/DashboardPage"));
const AdminProducts = lazy(() => import("./pages/admin/ProductsPage"));
const AdminProductForm = lazy(() => import("./pages/admin/ProductFormPage"));
const AdminCategories = lazy(() => import("./pages/admin/CategoriesPage"));
const AdminOrders = lazy(() => import("./pages/admin/OrdersPage"));
const AdminOrderDetail = lazy(() => import("./pages/admin/OrderDetailPage"));
const AdminCustomers = lazy(() => import("./pages/admin/CustomersPage"));

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <Spinner />;
  if (status === "guest") return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return children;
}

/** Hides admin UI from customers. The API enforces the same rule on every admin route. */
function RequireAdmin({ children }: { children: ReactNode }) {
  const { status, isAdmin } = useAuth();
  const location = useLocation();
  if (status === "loading") return <Spinner />;
  if (status === "guest") return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!isAdmin)
    return (
      <div className="min-h-dvh bg-bg">
        <EmptyState title="Admins only" action={<ButtonLink to="/">Back to the store</ButtonLink>}>
          Your account doesn't have access to the admin panel.
        </EmptyState>
      </div>
    );
  return children;
}

export const router = createBrowserRouter([
  {
    element: <StoreLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "shop", element: <ShopPage /> },
      { path: "product/:slug", element: <ProductPage /> },
      { path: "cart", element: <CartPage /> },
      { path: "checkout", element: <RequireAuth><CheckoutPage /></RequireAuth> },
      { path: "checkout/success/:id", element: <RequireAuth><OrderPlacedPage /></RequireAuth> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      { path: "forgot-password", element: <ForgotPasswordPage /> },
      { path: "reset-password", element: <ResetPasswordPage /> },
      {
        path: "account",
        element: <RequireAuth><AccountLayout /></RequireAuth>,
        children: [
          { index: true, element: <OrdersPage /> },
          { path: "orders/:id", element: <OrderDetailPage /> },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
      { path: "*", element: <NotFound /> },
    ],
  },
  {
    path: "admin",
    element: <RequireAdmin><AdminLayout /></RequireAdmin>,
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: "products", element: <AdminProducts /> },
      { path: "products/new", element: <AdminProductForm /> },
      { path: "products/:id", element: <AdminProductForm /> },
      { path: "categories", element: <AdminCategories /> },
      { path: "orders", element: <AdminOrders /> },
      { path: "orders/:id", element: <AdminOrderDetail /> },
      { path: "customers", element: <AdminCustomers /> },
    ],
  },
]);
