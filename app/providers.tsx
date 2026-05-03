"use client";

import { useState, type ReactNode } from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lightTheme } from "@/lib/theme";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
          // Phase 8: TanStack Query's default `networkMode: "online"` pauses
          // mutations when navigator.onLine === false, which would prevent our
          // `tryOnlineOrEnqueue` wrapper from ever running the offline branch.
          // We own the offline contract ourselves (enqueue → IDB → /api/sync/replay),
          // so mutations must always invoke their mutationFn regardless of network.
          mutations: { networkMode: "always" },
        },
      }),
  );

  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={lightTheme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
