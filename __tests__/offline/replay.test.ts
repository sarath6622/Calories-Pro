/**
 * Phase 8 — drain logic unit tests.
 *
 * Uses fake-indexeddb for the queue and a stub `fetcher` so tests don't need
 * a network. The drain function is a thin orchestrator over queue.ts and the
 * /api/sync/replay endpoint, so the tests focus on:
 *   - happy path (all items drained)
 *   - duplicate-on-retry (server has already seen the id)
 *   - permanent failure (not retryable → dropped)
 *   - retryable failure (retried → bumps retry counter)
 *   - network failure (fetcher rejects → all items kept, retries bumped)
 *   - 401 (auth lost → no retry bump, items kept intact)
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  enqueue,
  listQueue,
  queueSize,
  __resetForTests,
} from "@/lib/offline/queue";
import { drainOnce, drainUntilEmpty } from "@/lib/offline/replay";
import type { ReplayResponse } from "@/lib/offline/types";

beforeEach(() => {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  __resetForTests();
});

function fakeJsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("drainOnce", () => {
  it("returns zeros when the queue is empty without making a network call", async () => {
    const fetcher = vi.fn();
    const r = await drainOnce({ fetcher: fetcher as unknown as typeof fetch });
    expect(r).toEqual({ attempted: 0, drained: 0, failed: 0, skipped: 0, remaining: 0 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("dequeues every item the server returned `created` for", async () => {
    const a = await enqueue("water", { date: "2026-05-03", amountMl: 250 });
    const b = await enqueue("exercise", { date: "2026-05-03", caloriesBurned: 100 });
    const fetcher = vi.fn().mockResolvedValue(
      fakeJsonResponse(200, {
        results: [
          { id: a.id, status: "created", serverId: "srv-a" },
          { id: b.id, status: "created", serverId: "srv-b" },
        ],
      } satisfies ReplayResponse),
    );
    const r = await drainOnce({ fetcher: fetcher as unknown as typeof fetch });
    expect(r.attempted).toBe(2);
    expect(r.drained).toBe(2);
    expect(r.failed).toBe(0);
    expect(r.remaining).toBe(0);
    expect(await queueSize()).toBe(0);
  });

  it("treats `duplicate` like `created` — the server already has it, so dequeue", async () => {
    const a = await enqueue("water", { date: "2026-05-03", amountMl: 250 });
    const fetcher = vi.fn().mockResolvedValue(
      fakeJsonResponse(200, {
        results: [{ id: a.id, status: "duplicate", serverId: "srv-a" }],
      } satisfies ReplayResponse),
    );
    const r = await drainOnce({ fetcher: fetcher as unknown as typeof fetch });
    expect(r.drained).toBe(1);
    expect(await queueSize()).toBe(0);
  });

  it("drops permanent failures (retryable: false) — keeping them around blocks future drains", async () => {
    const a = await enqueue("water", { date: "2026-05-03", amountMl: 999_999 });
    const fetcher = vi.fn().mockResolvedValue(
      fakeJsonResponse(200, {
        results: [{ id: a.id, status: "failed", error: "Validation failed", retryable: false }],
      } satisfies ReplayResponse),
    );
    const r = await drainOnce({ fetcher: fetcher as unknown as typeof fetch });
    expect(r.drained).toBe(0);
    expect(r.failed).toBe(1);
    expect(await queueSize()).toBe(0);
  });

  it("keeps retryable failures and bumps their retry counter", async () => {
    const a = await enqueue("water", { date: "2026-05-03", amountMl: 250 });
    const fetcher = vi.fn().mockResolvedValue(
      fakeJsonResponse(200, {
        results: [{ id: a.id, status: "failed", error: "DB unreachable", retryable: true }],
      } satisfies ReplayResponse),
    );
    const r = await drainOnce({ fetcher: fetcher as unknown as typeof fetch });
    expect(r.failed).toBe(1);
    expect(r.drained).toBe(0);
    expect(r.remaining).toBe(1);
    const remaining = await listQueue();
    expect(remaining[0]?.retries).toBe(1);
  });

  it("network failure (fetcher rejects): keeps everything, bumps every retry counter", async () => {
    const a = await enqueue("water", { date: "2026-05-03", amountMl: 250 });
    const b = await enqueue("water", { date: "2026-05-03", amountMl: 500 });
    const fetcher = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const r = await drainOnce({ fetcher: fetcher as unknown as typeof fetch });
    expect(r.attempted).toBe(2);
    expect(r.drained).toBe(0);
    expect(r.failed).toBe(2);
    expect(await queueSize()).toBe(2);
    const items = await listQueue();
    expect(items.every((i) => i.retries === 1)).toBe(true);
    expect(a.id).not.toBe(b.id);
  });

  it("401 auth lost: keeps queue intact, does NOT bump retries (data is fine, session isn't)", async () => {
    const a = await enqueue("water", { date: "2026-05-03", amountMl: 250 });
    const fetcher = vi.fn().mockResolvedValue(fakeJsonResponse(401, { error: "Unauthenticated" }));
    const r = await drainOnce({ fetcher: fetcher as unknown as typeof fetch });
    expect(r.skipped).toBe(1);
    expect(r.failed).toBe(0);
    expect(r.drained).toBe(0);
    expect(await queueSize()).toBe(1);
    const items = await listQueue();
    expect(items[0]?.retries).toBe(0);
    expect(items[0]?.id).toBe(a.id);
  });

  it("respects batchSize so a 100-item queue doesn't send one giant request", async () => {
    for (let i = 0; i < 5; i++) {
      await enqueue("water", { date: "2026-05-03", amountMl: 100 + i });
    }
    const fetcher = vi.fn().mockResolvedValue(
      fakeJsonResponse(200, { results: [] } satisfies ReplayResponse),
    );
    await drainOnce({ fetcher: fetcher as unknown as typeof fetch, batchSize: 2 });
    const sentBody = JSON.parse((fetcher.mock.calls[0]?.[1] as RequestInit | undefined)?.body as string);
    expect(sentBody.items).toHaveLength(2);
  });
});

describe("drainUntilEmpty", () => {
  it("loops until the queue is empty when every batch succeeds", async () => {
    for (let i = 0; i < 3; i++) {
      await enqueue("water", { date: "2026-05-03", amountMl: 100 + i });
    }
    let call = 0;
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      call += 1;
      const body = JSON.parse((init?.body as string) ?? "{}");
      const items = body.items as Array<{ id: string }>;
      return fakeJsonResponse(200, {
        results: items.map((it) => ({ id: it.id, status: "created", serverId: `srv-${it.id}` })),
      });
    });
    const results = await drainUntilEmpty(10, {
      fetcher: fetcher as unknown as typeof fetch,
      batchSize: 2,
    });
    expect(call).toBeGreaterThanOrEqual(2);
    expect(await queueSize()).toBe(0);
    const totalDrained = results.reduce((s, r) => s + r.drained, 0);
    expect(totalDrained).toBe(3);
  });

  it("breaks the loop on a 0-drain batch — does not infinite-loop on persistent failure", async () => {
    await enqueue("water", { date: "2026-05-03", amountMl: 100 });
    const fetcher = vi.fn().mockRejectedValue(new TypeError("offline"));
    const results = await drainUntilEmpty(10, {
      fetcher: fetcher as unknown as typeof fetch,
    });
    // First batch fails completely → drained === 0 → loop breaks.
    expect(results).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await queueSize()).toBe(1);
  });
});
