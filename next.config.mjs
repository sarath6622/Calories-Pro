import nextPwa from "next-pwa";

// Phase 8 — PWA & offline support.
// `next-pwa` wraps the Next config and emits a Workbox-built service worker into /public.
// Disabled in development so the dev HMR socket isn't shadowed by stale precache hits.
const withPWA = nextPwa({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // Buildtime precache scope. The app shell is whatever Next emits in `_next/static`;
  // Workbox handles the manifest automatically.
  runtimeCaching: [
    // API GETs: stale-while-revalidate (F-PWA-2). The cached copy lets the dashboard render
    // instantly on relaunch; the network refresh updates it in the background.
    {
      urlPattern: /^\/api\/.*$/i,
      method: "GET",
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "caloriespro-api-get",
        expiration: { maxEntries: 256, maxAgeSeconds: 60 * 60 * 24 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // API mutations: network-only. We do NOT use Workbox's BackgroundSyncPlugin because
    // the offline queue is owned by our own IndexedDB store + /api/sync/replay endpoint
    // (see lib/offline/queue.ts). Workbox would replay raw requests; we want UUID-keyed
    // idempotent batch replay so cross-app retries can't double-create.
    {
      urlPattern: /^\/api\/.*$/i,
      method: "POST",
      handler: "NetworkOnly",
    },
    {
      urlPattern: /^\/api\/.*$/i,
      method: "PATCH",
      handler: "NetworkOnly",
    },
    {
      urlPattern: /^\/api\/.*$/i,
      method: "DELETE",
      handler: "NetworkOnly",
    },
    // Same-origin static assets (icons, manifest): cache-first.
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|webp|ico|gif|json)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "caloriespro-static",
        expiration: { maxEntries: 128, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    // Page navigations: network-first with a 3 s timeout, fall back to cache so the app
    // shell still opens when offline.
    {
      urlPattern: ({ request }) => request.mode === "navigate",
      handler: "NetworkFirst",
      options: {
        cacheName: "caloriespro-pages",
        networkTimeoutSeconds: 3,
        expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withPWA(nextConfig);
