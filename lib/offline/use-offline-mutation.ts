/**
 * Phase 8 — `tryOnlineOrEnqueue`: the single client-side helper every log form
 * uses to send a mutation. It encapsulates the F-PWA-4 contract:
 *
 *   1. If `navigator.onLine === false` at call time, skip the network and
 *      enqueue immediately.
 *   2. Otherwise attempt the POST. On a network error (TypeError thrown by
 *      `fetch`) — meaning the browser thinks it's online but the request
 *      didn't reach the server — fall through to enqueue.
 *   3. Anything else (4xx/5xx) is a real server-side rejection and bubbles up
 *      so the form can show the validation error in its red Alert.
 *
 * The "queued" toast fires only when we actually wrote to IndexedDB.
 */
import { enqueue } from "./queue";
import type { QueueType } from "./types";
import { pushOfflineToast } from "./toast-store";

export interface OnlineOrEnqueueResult {
  /** "online": the server accepted the write. */
  /** "queued": payload was enqueued; nothing on the server yet. */
  outcome: "online" | "queued";
  /** Server response when outcome === "online", else null. */
  response: Response | null;
}

interface OnlineOrEnqueueOptions {
  type: QueueType;
  url: string;
  payload: Record<string, unknown>;
  /** Optional message override for the queued toast. */
  queuedMessage?: string;
}

function isOnline(): boolean {
  // SSR / Node test envs: treat as online so server tests don't see the queue.
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

export async function tryOnlineOrEnqueue(
  opts: OnlineOrEnqueueOptions,
): Promise<OnlineOrEnqueueResult> {
  if (!isOnline()) {
    await enqueue(opts.type, opts.payload);
    pushOfflineToast(
      "info",
      opts.queuedMessage ?? "You're offline — entry queued and will sync automatically.",
    );
    return { outcome: "queued", response: null };
  }

  try {
    const response = await fetch(opts.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(opts.payload),
    });
    // Server replied (even with an error code). Let the caller decide how to
    // handle non-OK responses — we do NOT enqueue on 4xx because the payload
    // is bad and replaying it offline would just fail again.
    return { outcome: "online", response };
  } catch {
    // Network-layer failure (DNS, TLS, connection refused, lost during flight).
    // Treat as offline and queue.
    await enqueue(opts.type, opts.payload);
    pushOfflineToast(
      "info",
      opts.queuedMessage ?? "Network unreachable — entry queued and will sync automatically.",
    );
    return { outcome: "queued", response: null };
  }
}
