import { Suspense } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../../providers/AuthProvider";
import { cn } from "../../lib/cn";
import { Spinner } from "../../components/ui/Feedback";

export default function AccountLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const tab = ({ isActive }: { isActive: boolean }) =>
    cn("-mb-px border-b-2 px-1 pb-3 text-[0.95rem] transition-colors", isActive ? "border-ink font-medium text-ink" : "border-transparent text-muted hover:text-ink");

  return (
    <div className="container-page pt-8 sm:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{user?.email}</p>
          <h1 className="display mt-1 text-4xl sm:text-5xl">Hello, {user?.name.split(" ")[0]}</h1>
        </div>
        <button
          type="button"
          className="link-underline text-sm"
          onClick={async () => {
            await logout();
            toast.success("You're signed out");
            navigate("/");
          }}
        >
          Sign out
        </button>
      </div>
      <nav aria-label="Account" className="mt-8 flex gap-6 border-b border-line">
        <NavLink to="/account" end className={tab}>
          Orders
        </NavLink>
        <NavLink to="/account/profile" className={tab}>
          Profile
        </NavLink>
      </nav>
      <div className="pt-8">
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
