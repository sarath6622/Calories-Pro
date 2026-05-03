import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import { OfflineSyncOrchestrator } from "@/components/offline/sync-orchestrator";
import { InstallPrompt } from "@/components/offline/install-prompt";

export const metadata: Metadata = {
  title: "CaloriesPro",
  description: "Calorie & Wellness Tracker — track intake, exercise, hydration, sleep, and body.",
  applicationName: "CaloriesPro",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CaloriesPro",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1976d2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {/* Phase 8: orchestrator drains the IndexedDB sync queue on `online` events
              and on app mount; install prompt captures `beforeinstallprompt` and exposes
              an "Install" button on supported browsers. Both render nothing visible until
              the relevant browser event fires. */}
          <OfflineSyncOrchestrator />
          <InstallPrompt />
          {children}
        </Providers>
      </body>
    </html>
  );
}
