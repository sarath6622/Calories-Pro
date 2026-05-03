"use client";

/**
 * Phase 8 — root-level orchestrator that:
 *  1. Drains the IndexedDB sync queue on mount and on every `online` event.
 *  2. Schedules backoff retries when a drain partially fails.
 *  3. Renders Snackbars from the offline-toast store (queue/sync notices).
 *
 * Mounted once in app/layout.tsx so every authenticated route benefits without
 * each page having to opt in.
 */
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { drainOnce, drainUntilEmpty } from "@/lib/offline/replay";
import { queueSize, nextBackoffMs } from "@/lib/offline/queue";
import { pushOfflineToast, useOfflineToastStore } from "@/lib/offline/toast-store";

export function OfflineSyncOrchestrator() {
  const queryClient = useQueryClient();
  const toasts = useOfflineToastStore((s) => s.toasts);
  const dismiss = useOfflineToastStore((s) => s.dismiss);

  // Track scheduled retries so we cancel them on unmount or re-trigger.
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track "max retries seen so far in this session" to scale the next backoff.
  const seenRetries = useRef(0);
  const inFlight = useRef(false);

  const [hasPending, setHasPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    /** Drain everything we can right now; on partial failure, schedule a retry. */
    async function attemptDrain() {
      if (cancelled) return;
      if (inFlight.current) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;

      inFlight.current = true;
      try {
        const before = await queueSize();
        if (before === 0) {
          setHasPending(false);
          return;
        }
        const results = await drainUntilEmpty(20);
        const totalDrained = results.reduce((s, r) => s + r.drained, 0);
        const totalFailed = results.reduce((s, r) => s + r.failed, 0);
        const remaining = await queueSize();
        setHasPending(remaining > 0);

        if (totalDrained > 0) {
          pushOfflineToast(
            "success",
            totalDrained === 1
              ? "1 queued entry synced."
              : `${totalDrained} queued entries synced.`,
          );
          // Refresh any visible list/dashboard query so the synced rows appear.
          await queryClient.invalidateQueries();
        }

        if (remaining > 0 && totalFailed > 0) {
          // Schedule a backoff retry. Use the in-session retry counter rather
          // than the per-row retries so we don't hammer right after a global
          // failure (e.g. server is down).
          seenRetries.current = Math.min(seenRetries.current + 1, 12);
          const delay = nextBackoffMs(seenRetries.current);
          if (retryTimer.current) clearTimeout(retryTimer.current);
          retryTimer.current = setTimeout(() => {
            void attemptDrain();
          }, delay);
        } else {
          // Reset backoff on a clean drain.
          seenRetries.current = 0;
        }
      } finally {
        inFlight.current = false;
      }
    }

    /** Initial drain — covers "user re-opens the tab while online with stuff queued". */
    void (async () => {
      const size = await queueSize().catch(() => 0);
      setHasPending(size > 0);
      void attemptDrain();
    })();

    function onOnline() {
      // Clear any pending backoff timer; we just got online, try immediately.
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
      seenRetries.current = 0;
      void attemptDrain();
    }

    function onOffline() {
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // Surface a snackbar exactly once when the user goes offline so they
    // understand why their next mutation says "queued".
    function onOfflineNotice() {
      pushOfflineToast("warning", "You're offline. New entries will sync when you reconnect.");
    }
    window.addEventListener("offline", onOfflineNotice);

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("offline", onOfflineNotice);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
    // queryClient is stable across renders (provided by Providers via useState).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render: one snackbar at a time so they don't stack confusingly. If multiple
  // toasts are queued, MUI's Snackbar shows the head and rotates in the next
  // when the user dismisses.
  const head = toasts[0];

  return (
    <>
      {head && (
        <Snackbar
          key={head.id}
          open
          autoHideDuration={4500}
          onClose={(_, reason) => {
            if (reason === "clickaway") return;
            dismiss(head.id);
          }}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            severity={head.severity}
            variant="filled"
            onClose={() => dismiss(head.id)}
            data-testid="offline-toast"
          >
            {head.message}
          </Alert>
        </Snackbar>
      )}
      {hasPending && (
        // hidden test-id sentinel so e2e can assert "queue had pending items"
        // without depending on toast timing. Visually invisible (sr-only).
        <span
          aria-hidden="true"
          data-testid="offline-queue-pending"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        />
      )}
    </>
  );
}

/** Re-export so log forms can call drains imperatively after enqueueing online. */
export { drainOnce };
