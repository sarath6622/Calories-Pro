import { describe, expect, it } from "vitest";
import { SleepCreateSchema, SleepUpdateSchema } from "@/lib/validation/sleep-log";

const valid = {
  date: "2026-05-03",
  bedtime: "2026-05-02T23:00:00.000Z",
  wakeTime: "2026-05-03T07:00:00.000Z",
  quality: 4,
  note: null,
};

describe("SleepCreateSchema", () => {
  it("accepts a valid payload", () => {
    expect(SleepCreateSchema.parse(valid)).toMatchObject(valid);
  });

  it("rejects wakeTime equal to bedtime", () => {
    const out = SleepCreateSchema.safeParse({
      ...valid,
      bedtime: "2026-05-03T07:00:00.000Z",
      wakeTime: "2026-05-03T07:00:00.000Z",
    });
    expect(out.success).toBe(false);
  });

  it("rejects wakeTime before bedtime", () => {
    const out = SleepCreateSchema.safeParse({
      ...valid,
      bedtime: "2026-05-03T08:00:00.000Z",
      wakeTime: "2026-05-03T07:00:00.000Z",
    });
    expect(out.success).toBe(false);
  });

  it("rejects out-of-range quality", () => {
    expect(SleepCreateSchema.safeParse({ ...valid, quality: 0 }).success).toBe(false);
    expect(SleepCreateSchema.safeParse({ ...valid, quality: 6 }).success).toBe(false);
    expect(SleepCreateSchema.safeParse({ ...valid, quality: 3.5 }).success).toBe(false);
  });

  it("rejects malformed bedtime/wakeTime", () => {
    expect(SleepCreateSchema.safeParse({ ...valid, bedtime: "not-a-date" }).success).toBe(false);
  });

  it("rejects unknown extras (strict)", () => {
    expect(SleepCreateSchema.safeParse({ ...valid, durationMinutes: 480 } as never).success).toBe(
      false,
    );
  });
});

describe("SleepUpdateSchema", () => {
  it("accepts a quality-only update", () => {
    expect(SleepUpdateSchema.parse({ quality: 5 })).toEqual({ quality: 5 });
  });

  it("accepts a both-timestamps update", () => {
    const ok = SleepUpdateSchema.parse({
      bedtime: "2026-05-02T23:00:00.000Z",
      wakeTime: "2026-05-03T07:00:00.000Z",
    });
    expect(ok.bedtime).toBeDefined();
    expect(ok.wakeTime).toBeDefined();
  });

  it("rejects empty body", () => {
    expect(SleepUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("rejects when both timestamps are present and inverted", () => {
    expect(
      SleepUpdateSchema.safeParse({
        bedtime: "2026-05-03T08:00:00.000Z",
        wakeTime: "2026-05-03T07:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("accepts a single-timestamp update (the route layer recomputes duration and 400s if the result is inconsistent)", () => {
    // Schema only cross-validates when BOTH timestamps are sent. A single
    // timestamp passes Zod; the API handler then recomputes durationMinutes
    // against the persisted counterpart and returns 400 if the new value
    // would be ≤ 0. This is intentional — Zod can't see persisted state.
    expect(SleepUpdateSchema.safeParse({ bedtime: "2026-05-03T22:00:00.000Z" }).success).toBe(true);
    expect(SleepUpdateSchema.safeParse({ wakeTime: "2026-05-04T07:00:00.000Z" }).success).toBe(
      true,
    );
  });

  it("rejects unknown extras (strict)", () => {
    expect(
      SleepUpdateSchema.safeParse({ quality: 4, durationMinutes: 480 } as never).success,
    ).toBe(false);
  });
});
