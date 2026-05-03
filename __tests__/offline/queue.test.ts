/**
 * Phase 8 — IndexedDB sync-queue unit tests.
 *
 * Uses `fake-indexeddb` to provide an in-memory IDBFactory under jsdom. Each
 * test gets a fresh DB by resetting the cached connection AND replacing
 * `globalThis.indexedDB` with a brand-new `IDBFactory` so cases stay isolated.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, beforeEach } from "vitest";

import {
  enqueue,
  listQueue,
  queueSize,
  dequeueMany,
  incrementRetry,
  clearQueue,
  nextBackoffMs,
  __resetForTests,
} from "@/lib/offline/queue";

beforeEach(() => {
  // Fresh IDBFactory + cached-connection reset per test.
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  __resetForTests();
});

describe("enqueue / listQueue", () => {
  it("appends a queue entry with a fresh UUID and zero retries", async () => {
    const e = await enqueue("water", { date: "2026-05-03", amountMl: 250 }, 1000);
    expect(e.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(e.retries).toBe(0);
    expect(e.createdAt).toBe(1000);
    expect(e.payload).toEqual({ date: "2026-05-03", amountMl: 250 });
    expect(e.type).toBe("water");
  });

  it("listQueue returns entries oldest-first (sorted by createdAt index)", async () => {
    await enqueue("water", { amountMl: 100 }, 200);
    await enqueue("exercise", { caloriesBurned: 50 }, 100);
    await enqueue("food_log", { servings: 1 }, 300);
    const items = await listQueue();
    expect(items.map((i) => i.createdAt)).toEqual([100, 200, 300]);
  });

  it("rejects an unknown queue type with a descriptive error", async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      enqueue("not_a_real_type" as any, {}),
    ).rejects.toThrow(/unknown queue type/i);
  });

  it("queueSize tracks count across operations", async () => {
    expect(await queueSize()).toBe(0);
    await enqueue("water", { amountMl: 250 });
    await enqueue("water", { amountMl: 500 });
    expect(await queueSize()).toBe(2);
  });
});

describe("dequeueMany / clearQueue", () => {
  it("removes only the listed ids", async () => {
    const a = await enqueue("water", { amountMl: 100 });
    const b = await enqueue("water", { amountMl: 200 });
    const c = await enqueue("water", { amountMl: 300 });
    await dequeueMany([a.id, c.id]);
    const remaining = await listQueue();
    expect(remaining.map((r) => r.id)).toEqual([b.id]);
  });

  it("dequeueMany([]) is a no-op", async () => {
    await enqueue("water", { amountMl: 100 });
    await dequeueMany([]);
    expect(await queueSize()).toBe(1);
  });

  it("clearQueue empties the store", async () => {
    await enqueue("water", { amountMl: 100 });
    await enqueue("exercise", { caloriesBurned: 50 });
    await clearQueue();
    expect(await queueSize()).toBe(0);
  });
});

describe("incrementRetry", () => {
  it("bumps the counter atomically and returns the new value", async () => {
    const e = await enqueue("sleep", { quality: 4 });
    const r1 = await incrementRetry(e.id);
    const r2 = await incrementRetry(e.id);
    expect(r1).toBe(1);
    expect(r2).toBe(2);
    const after = await listQueue();
    expect(after[0]?.retries).toBe(2);
  });

  it("returns 0 when the id is unknown (already drained) without throwing", async () => {
    const result = await incrementRetry("00000000-0000-4000-8000-000000000000");
    expect(result).toBe(0);
  });
});

describe("nextBackoffMs", () => {
  it("ramps exponentially: 1s, 2s, 4s, 8s, 16s", () => {
    expect(nextBackoffMs(0)).toBe(1000);
    expect(nextBackoffMs(1)).toBe(2000);
    expect(nextBackoffMs(2)).toBe(4000);
    expect(nextBackoffMs(3)).toBe(8000);
    expect(nextBackoffMs(4)).toBe(16_000);
  });

  it("caps at 5 minutes — a long-failing item does not back off forever", () => {
    expect(nextBackoffMs(10)).toBe(300_000);
    expect(nextBackoffMs(50)).toBe(300_000);
  });

  it("treats negative input as zero (defensive against stale callers)", () => {
    expect(nextBackoffMs(-1)).toBe(0);
  });
});
