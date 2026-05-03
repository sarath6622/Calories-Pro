import { describe, expect, it } from "vitest";
import { sleepDurationMinutes } from "@/lib/log/sleep";

describe("sleepDurationMinutes", () => {
  it("computes whole-hour duration", () => {
    const bedtime = new Date("2026-05-03T23:00:00Z");
    const wakeTime = new Date("2026-05-04T07:00:00Z");
    expect(sleepDurationMinutes(bedtime, wakeTime)).toBe(8 * 60);
  });

  it("computes a duration that crosses midnight (PRD §4.6 edge case)", () => {
    // 23:30 → 07:15 next day = 7h 45m = 465 minutes
    const bedtime = new Date("2026-05-03T23:30:00Z");
    const wakeTime = new Date("2026-05-04T07:15:00Z");
    expect(sleepDurationMinutes(bedtime, wakeTime)).toBe(7 * 60 + 45);
  });

  it("computes a same-day daytime nap", () => {
    const bedtime = new Date("2026-05-03T13:00:00Z");
    const wakeTime = new Date("2026-05-03T14:30:00Z");
    expect(sleepDurationMinutes(bedtime, wakeTime)).toBe(90);
  });

  it("rounds to the nearest minute", () => {
    const bedtime = new Date("2026-05-03T23:00:00Z");
    const wakeTime = new Date("2026-05-04T07:00:30Z"); // 30s past
    expect(sleepDurationMinutes(bedtime, wakeTime)).toBe(8 * 60 + 1);
  });

  it("returns null when wakeTime equals bedtime", () => {
    const t = new Date("2026-05-03T23:00:00Z");
    expect(sleepDurationMinutes(t, t)).toBeNull();
  });

  it("returns null when wakeTime is before bedtime", () => {
    const bedtime = new Date("2026-05-04T07:00:00Z");
    const wakeTime = new Date("2026-05-03T23:00:00Z");
    expect(sleepDurationMinutes(bedtime, wakeTime)).toBeNull();
  });

  it("returns null when either Date is invalid", () => {
    const valid = new Date("2026-05-03T23:00:00Z");
    expect(sleepDurationMinutes(new Date("not-a-date"), valid)).toBeNull();
    expect(sleepDurationMinutes(valid, new Date("not-a-date"))).toBeNull();
  });

  it("computes a long sleep across multiple days (sanity)", () => {
    const bedtime = new Date("2026-05-03T22:00:00Z");
    const wakeTime = new Date("2026-05-05T06:00:00Z"); // 32 hours
    expect(sleepDurationMinutes(bedtime, wakeTime)).toBe(32 * 60);
  });
});
