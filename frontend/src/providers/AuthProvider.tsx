import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post, setUnauthorizedHandler, TOKEN_KEY } from "../lib/api";
import { storage } from "../lib/storage";
import { guestCart } from "../lib/guestCart";
import type { Cart, User } from "../lib/types";

type Session = { token: string; user: User };

type AuthContextValue = {
  user: User | null;
  status: "loading" | "authenticated" | "guest";
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  /** Replace the session (e.g. after a password change issues a new token). */
  setSession: (s: Session) => void;
  setUser: (u: User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(() => storage.get(TOKEN_KEY));

  const me = useQuery({
    queryKey: ["me", token],
    queryFn: () => get<{ user: User }>("/auth/me").then((r) => r.user),
    enabled: !!token,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const clearLocal = useCallback(() => {
    storage.remove(TOKEN_KEY);
    setToken(null);
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "products" && q.queryKey[0] !== "categories" && q.queryKey[0] !== "shipping" });
  }, [qc]);

  useEffect(() => {
    setUnauthorizedHandler(clearLocal);
  }, [clearLocal]);

  const startSession = useCallback(
    async ({ token: t, user }: Session) => {
      storage.set(TOKEN_KEY, t);
      qc.setQueryData(["me", t], user);
      setToken(t);
      // Merge the guest bag into the server cart. Runs from the event handler, never an effect,
      // so StrictMode double-mounting cannot merge twice.
      const lines = guestCart.snapshot();
      if (lines.length) {
        try {
          const cart = await post<Cart>("/cart/merge", {
            items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
          });
          qc.setQueryData(["cart"], cart);
          guestCart.clear();
        } catch {
          /* keep the guest bag; the user can retry by signing in again */
        }
      }
      return user;
    },
    [qc],
  );

  const login = useCallback(
    async (email: string, password: string) => startSession(await post<Session>("/auth/login", { email, password })),
    [startSession],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) =>
      startSession(await post<Session>("/auth/register", { name, email, password })),
    [startSession],
  );

  const logout = useCallback(async () => {
    try {
      await post("/auth/logout");
    } catch {
      /* token may already be invalid; sign out locally regardless */
    }
    clearLocal();
  }, [clearLocal]);

  const setSession = useCallback(
    (s: Session) => {
      storage.set(TOKEN_KEY, s.token);
      qc.setQueryData(["me", s.token], s.user);
      setToken(s.token);
    },
    [qc],
  );

  const setUser = useCallback((u: User) => qc.setQueryData(["me", token], u), [qc, token]);

  const user = token ? (me.data ?? null) : null;
  const status: AuthContextValue["status"] = !token ? "guest" : me.isPending ? "loading" : user ? "authenticated" : "guest";

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, isAdmin: user?.role === "ADMIN", login, register, logout, setSession, setUser }),
    [user, status, login, register, logout, setSession, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
