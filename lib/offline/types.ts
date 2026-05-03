/**
 * Phase 8 — shared types for the offline sync queue.
 *
 * These types are consumed by both client code (lib/offline/queue.ts,
 * components/offline/*) and the server-side replay endpoint
 * (app/api/sync/replay/route.ts) so the wire shape stays in lockstep
 * between the producer (queued mutation) and the consumer (replay batch).
 */

/**
 * The five offline-replayable log types per F-PWA-4. Wire-format strings —
 * persisted in IndexedDB and sent to /api/sync/replay; do not rename.
 */
export const QUEUE_TYPES = ["food_log", "exercise", "water", "sleep", "measurement"] as const;
export type QueueType = (typeof QUEUE_TYPES)[number];

/**
 * One row of the IndexedDB OfflineSyncQueue store. Mirrors PRD §4.8 verbatim.
 *
 * - `id` is a client-generated UUID (uuid v4). Same id → same logical mutation,
 *   even across replay retries. The /api/sync/replay endpoint dedupes by id so
 *   a network glitch mid-replay can't double-create.
 * - `payload` is the original POST body the page would have sent (e.g.
 *   `{ date, amountMl }` for water). Validated server-side by the same Zod
 *   schema the live POST endpoint uses.
 * - `retries` increments on each failed replay; the orchestrator uses this
 *   value to compute the next backoff delay.
 */
export interface QueueEntry {
  id: string;
  type: QueueType;
  payload: Record<string, unknown>;
  createdAt: number;
  retries: number;
}

/**
 * Per-item replay result. The endpoint returns one of these per submitted
 * id so the client can mark each row as drained or scheduled for retry.
 */
export type ReplayItemStatus =
  | { id: string; status: "created"; serverId: string }
  | { id: string; status: "duplicate"; serverId: string }
  | { id: string; status: "failed"; error: string; retryable: boolean };

export interface ReplayResponse {
  results: ReplayItemStatus[];
}
