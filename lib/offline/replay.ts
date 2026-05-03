/**
 * Phase 8 — drain the IndexedDB sync queue.
 *
 * Calls /api/sync/replay with all currently-queued entries; processes the
 * per-id results; deletes drained items; bumps retry counters on transient
 * failures so the next drain backs off (`nextBackoffMs` in queue.ts).
 *
 * Conflict policy is server-side (last-write-wins by `loggedAt`, F-PWA-6) —
 * the client just sends the queued payload as-is and trusts the server.
 */

import { listQueue, dequeueMany, incrementRetry, queueSize } from "./queue";
import type { ReplayItemStatus, ReplayResponse } from "./types";

export interface DrainResult {
  attempted: number;
  drained: number;
  failed: number;
  skipped: number;
  remaining: number;
}

interface DrainDeps {
  /** Override fetch in tests. */
  fetcher?: typeof fetch;
  /** Max items per batch — keeps payloads bounded for slow-3G replay. */
  batchSize?: number;
  /** Network-error retry: client never knows if server saw the request, so
   *  count it as retryable. */
  signal?: AbortSignal;
}

const DEFAULT_BATCH_SIZE = 50;

/**
 * Drain one batch from the queue. Returns counts so callers (including the
 * orchestrator's status indicator) can show "X queued / Y synced" UX.
 *
 * Idempotent at the row level: if the network drops between server-write and
 * the client receiving the response, the next drain re-sends the same UUID
 * and the server returns `{status: "duplicate"}` — the client deletes the row
 * anyway because the entry is on the server.
 */
export async function drainOnce(deps: DrainDeps = {}): Promise<DrainResult> {
  const fetcher = deps.fetcher ?? fetch;
  const batchSize = deps.batchSize ?? DEFAULT_BATCH_SIZE;

  const all = await listQueue();
  if (all.length === 0) {
    return { attempted: 0, drained: 0, failed: 0, skipped: 0, remaining: 0 };
  }

  const batch = all.slice(0, batchSize);

  let response: Response;
  try {
    response = await fetcher("/api/sync/replay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: batch.map((e) => ({ id: e.id, type: e.type, payload: e.payload })),
      }),
      signal: deps.signal,
    });
  } catch {
    // Network error during drain — bump every item's retry counter so the next
    // attempt backs off, but don't dequeue.
    await Promise.all(batch.map((e) => incrementRetry(e.id)));
    return {
      attempted: batch.length,
      drained: 0,
      failed: batch.length,
      skipped: 0,
      remaining: all.length,
    };
  }

  if (response.status === 401) {
    // Auth lost — leave the queue intact; the user may sign back in. Don't bump
    // retries (the data isn't broken, just the session).
    return {
      attempted: batch.length,
      drained: 0,
      failed: 0,
      skipped: batch.length,
      remaining: all.length,
    };
  }

  if (!response.ok) {
    await Promise.all(batch.map((e) => incrementRetry(e.id)));
    return {
      attempted: batch.length,
      drained: 0,
      failed: batch.length,
      skipped: 0,
      remaining: all.length,
    };
  }

  const body = (await response.json().catch(() => null)) as ReplayResponse | null;
  if (!body || !Array.isArray(body.results)) {
    await Promise.all(batch.map((e) => incrementRetry(e.id)));
    return {
      attempted: batch.length,
      drained: 0,
      failed: batch.length,
      skipped: 0,
      remaining: all.length,
    };
  }

  const toDequeue: string[] = [];
  const toRetry: string[] = [];
  let drained = 0;
  let failed = 0;
  for (const item of body.results) {
    if (item.status === "created" || item.status === "duplicate") {
      toDequeue.push(item.id);
      drained += 1;
      continue;
    }
    // failed
    if (item.retryable) {
      toRetry.push(item.id);
      failed += 1;
    } else {
      // Permanent failure (validation error etc) — drop the entry; keeping it
      // around just blocks every future drain forever. The user has already
      // seen the "queued" toast and lost data here is rare (validation should
      // mostly be enforced client-side at enqueue time).
      toDequeue.push(item.id);
      failed += 1;
    }
  }

  if (toDequeue.length > 0) await dequeueMany(toDequeue);
  if (toRetry.length > 0) await Promise.all(toRetry.map((id) => incrementRetry(id)));

  const remaining = await queueSize();
  return {
    attempted: batch.length,
    drained,
    failed,
    skipped: 0,
    remaining,
  };
}

/**
 * Drain the queue repeatedly until either it's empty, a batch fails entirely,
 * or `maxBatches` is reached. The orchestrator calls this on `online` events.
 */
export async function drainUntilEmpty(
  maxBatches: number = 20,
  deps: DrainDeps = {},
): Promise<DrainResult[]> {
  const results: DrainResult[] = [];
  for (let i = 0; i < maxBatches; i++) {
    const r = await drainOnce(deps);
    results.push(r);
    if (r.attempted === 0 || r.drained === 0) break;
  }
  return results;
}

/** Re-export so the orchestrator can summarise progress. */
export type { ReplayItemStatus };
