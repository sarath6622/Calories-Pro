/**
 * Phase 8 — tiny zustand store for offline-related toasts.
 *
 * The five log views call `pushToast(...)` after a successful enqueue or after
 * a successful drain so the user gets a unified "Queued" / "Synced" UX without
 * each page having to render its own Snackbar. The OfflineSyncOrchestrator at
 * the root subscribes to this store and renders one Snackbar at a time.
 */
import { create } from "zustand";

export type ToastSeverity = "success" | "info" | "warning" | "error";

export interface OfflineToast {
  id: number;
  severity: ToastSeverity;
  message: string;
}

interface ToastStore {
  toasts: OfflineToast[];
  push: (severity: ToastSeverity, message: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useOfflineToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (severity, message) =>
    set((s) => ({ toasts: [...s.toasts, { id: nextId++, severity, message }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper for non-React callers (mutationFn closures, etc). */
export function pushOfflineToast(severity: ToastSeverity, message: string): void {
  useOfflineToastStore.getState().push(severity, message);
}
