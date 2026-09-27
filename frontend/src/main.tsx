import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import "@fontsource-variable/bodoni-moda/opsz.css";
import "@fontsource-variable/geist/wght.css";
import "./index.css";
import { router } from "./routes";
import { ApiError } from "./lib/api";
import { AuthProvider } from "./providers/AuthProvider";
import { CartProvider } from "./providers/CartProvider";
import { ThemeProvider, useTheme } from "./providers/ThemeProvider";
import { ConfirmProvider } from "./components/ui/Dialog";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // Don't retry client errors (404, 403…); retry network/server errors once.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 1,
    },
  },
});

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="bottom-center" richColors closeButton toastOptions={{ className: "font-sans" }} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CartProvider>
            <ConfirmProvider>
              <RouterProvider router={router} />
              <ThemedToaster />
            </ConfirmProvider>
          </CartProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
