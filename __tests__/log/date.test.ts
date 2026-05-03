import { describe, expect, it } from "vitest";
import { endOfDayUTC, isIsoDate, startOfDayUTC, todayIsoDate } from "@/lib/log/date";

describe("isIsoDate", () => {
  it("accepts YYYY-MM-DD", () => {
    expect(isIsoDate("2026-05-01")).toBe(true);
    expect(isIsoDate("2026-12-31")).toBe(true);
  });

  it("rejects malformed strings", () => {
    expect(isIsoDate("2026-5-1")).toBe(false);
    expect(isIsoDate("2026/05/01")).toBe(false);
    expect(isIsoDate("nope")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });

  it("rejects impossible dates that pass the regex", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
  });
});

describe("startOfDayUTC / endOfDayUTC", () => {
  it("anchors to UTC midnight", () => {
    const start = startOfDayUTC("2026-05-01");
    expect(start.toISOString()).toBe("2026-05-01T00:00:00.000Z");
  });

  it("end-of-day is the last millisecond of the same UTC day", () => {
    const end = endOfDayUTC("2026-05-01");
    expect(end.toISOString()).toBe("2026-05-01T23:59:59.999Z");
  });
});

describe("todayIsoDate", () => {
  it("formats local Y-M-D zero-padded", () => {
    expect(todayIsoDate(new Date(2026, 0, 5, 14, 30))).toBe("2026-01-05");
    expect(todayIsoDate(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });
});
