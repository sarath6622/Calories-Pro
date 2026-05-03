/**
 * Phase 8 — client-side IndexedDB-backed sync queue per PRD §4.8.
 *
 * Used by the five log-creation forms (food / exercise / water / sleep /
 * measurement): when `navigator.onLine === false`, we enqueue the mutation
 * here instead of POSTing it. The OfflineSyncOrchestrator drains the queue
 * on `online` events through /api/sync/replay.
 *
 * Why a hand-rolled queue rather than Workbox's BackgroundSyncPlugin?
 * - We need idempotency: replays must not double-create on retries. Workbox
 *   replays raw requests; our endpoint dedupes by client-generated UUID.
 * - We want to display "X queued entries" UX and let users see their pending
 *   work even after closing the tab — that requires a queryable store.
 * - The replay batch endpoint lets us amortise round-trips: drain 50 items
 *   in one POST, not 50 sequential ones.
 */

import { openDB, type IDBPDatabase, type DBSchema } from "idb";
import { v4 as uuidv4 } from "uuid";
import { QUEUE_TYPES, type QueueEntry, type QueueType } from "./types";

const DB_NAME = "caloriespro-offline";
const DB_VERSION = 1;
const STORE = "queue";

interface OfflineDB extends DBSchema {
  [STORE]: {
    key: string;
    value: QueueEntry;
    indexes: {
      byCreatedAt: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;

/**
 * Lazily open (and migrate to the current version) the IndexedDB database.
 * Cached so repeated callers share one open connection. Reset by tests via
 * `__resetForTests`.
 */
export function getDB(): Promise<IDBPDatabase<OfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("byCreatedAt", "createdAt", { unique: false });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Append a mutation to the queue. Returns the assigned UUID — callers should
 * keep it in case they want to optimistically render the entry and then
 * reconcile with the server id once replay completes.
 */
export async function enqueue(
  type: QueueType,
  payload: Record<string, unknown>,
  now: number = Date.now(),
): Promise<QueueEntry> {
  if (!QUEUE_TYPES.includes(type)) {
    throw new Error(`Unknown queue type: ${type}`);
  }
  const entry: QueueEntry = {
    id: uuidv4(),
    type,
    payload,
    createdAt: now,
    retries: 0,
  };
  const db = await getDB();
  await db.put(STORE, entry);
  return entry;
}

/** All queued entries, oldest first. */
export async function listQueue(): Promise<QueueEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex(STORE, "byCreatedAt");
}

/** Number of pending entries — used by the orchestrator's status indicator. */
export async function queueSize(): Promise<number> {
  const db = await getDB();
  return db.count(STORE);
}

/** Remove entries by id. Used after a successful (or duplicate) replay. */
export async function dequeueMany(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDB();
  const tx = db.transaction(STORE, "readwrite");
  await Promise.all(ids.map((id) => tx.store.delete(id)));
  await tx.done;
}

/**
 * Bump retry counter for a specific entry. Atomic via a readwrite tx so
 * concurrent drains can't double-increment.
 */
export async function incrementRetry(id: string): Promise<number> {
  const db = await getDB();
  const tx = db.transaction(STORE, "readwrite");
  const existing = await tx.store.get(id);
  if (!existing) {
    await tx.done;
    return 0;
  }
  const next: QueueEntry = { ...existing, retries: existing.retries + 1 };
  await tx.store.put(next);
  await tx.done;
  return next.retries;
}

/** Hard-clear the queue. Currently only used by tests. */
export async function clearQueue(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE);
}

/**
 * Reset the cached DB connection. Tests need to call this between cases so a
 * fake-indexeddb instance can be recreated. Production code should never use
 * this — the cached connection is by design.
 */
export function __resetForTests(): void {
  dbPromise = null;
}

/**
 * Compute the next backoff delay (in ms) for an entry with the given retry
 * count. Capped at 5 minutes so a long-failing item doesn't get stuck.
 *
 * Schedule: 1s, 2s, 4s, 8s, 16s, 32s, 64s, 128s, 256s, 300s (cap), 300s, …
 *
 * Pure function so it can be unit-tested without touching IndexedDB.
 */
export function nextBackoffMs(retries: number): number {
  if (retries < 0) return 0;
  const exp = Math.min(retries, 12);
  const ms = 1000 * 2 ** exp;
  return Math.min(ms, 5 * 60 * 1000);
}
