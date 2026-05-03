import { describe, expect, it } from "vitest";
import { metricSeries, summariseMetrics, type MeasurementEntryLike } from "@/lib/measurements/delta";

describe("summariseMetrics", () => {
  it("returns null for every metric when there are no entries", () => {
    const out = summariseMetrics([]);
    expect(out.weightKg).toBeNull();
    expect(out.chest).toBeNull();
    expect(out.bodyFatPercent).toBeNull();
  });

  it("first-ever entry: latest is set, previous and delta are null", () => {
    const out = summariseMetrics([{ date: "2026-05-01T00:00:00Z", weightKg: 70 }]);
    expect(out.weightKg).toEqual({
      metric: "weightKg",
      latest: { date: "2026-05-01T00:00:00.000Z", value: 70 },
      previous: null,
      delta: null,
    });
    // Other metrics still null.
    expect(out.chest).toBeNull();
  });

  it("computes signed delta for two consecutive entries (weight loss)", () => {
    const out = summariseMetrics([
      { date: "2026-05-01T00:00:00Z", weightKg: 72 },
      { date: "2026-05-08T00:00:00Z", weightKg: 71.2 },
    ]);
    expect(out.weightKg?.latest.value).toBe(71.2);
    expect(out.weightKg?.previous?.value).toBe(72);
    expect(out.weightKg?.delta).toBe(-0.8);
  });

  it("computes signed delta upward (weight gain)", () => {
    const out = summariseMetrics([
      { date: "2026-05-01T00:00:00Z", weightKg: 70 },
      { date: "2026-05-08T00:00:00Z", weightKg: 70.5 },
    ]);
    expect(out.weightKg?.delta).toBe(0.5);
  });

  it("ignores entry order — input does not need to be sorted", () => {
    const sorted = summariseMetrics([
      { date: "2026-05-01T00:00:00Z", weightKg: 72 },
      { date: "2026-05-08T00:00:00Z", weightKg: 71 },
    ]);
    const reversed = summariseMetrics([
      { date: "2026-05-08T00:00:00Z", weightKg: 71 },
      { date: "2026-05-01T00:00:00Z", weightKg: 72 },
    ]);
    expect(sorted).toEqual(reversed);
  });

  it("Phase 6 DoD: weight one day, chest the next — both metrics get a latest, neither has a delta yet", () => {
    const out = summariseMetrics([
      { date: "2026-05-01T00:00:00Z", weightKg: 70 },
      { date: "2026-05-02T00:00:00Z", measurementsCm: { chest: 100 } },
    ]);
    // Each metric is independent: weight has 1 sample, chest has 1 sample.
    expect(out.weightKg?.latest).toEqual({ date: "2026-05-01T00:00:00.000Z", value: 70 });
    expect(out.weightKg?.previous).toBeNull();
    expect(out.weightKg?.delta).toBeNull();

    expect(out.chest?.latest).toEqual({ date: "2026-05-02T00:00:00.000Z", value: 100 });
    expect(out.chest?.previous).toBeNull();
    expect(out.chest?.delta).toBeNull();
  });

  it("delta uses the previous non-null sample of the SAME metric, not the previous entry overall", () => {
    // Three entries: chest only, then weight only, then chest only. Chest's
    // delta must compare today's chest to the *first* entry's chest (skipping
    // the middle weight-only entry), not to anything from the weight entry.
    const out = summariseMetrics([
      { date: "2026-04-01T00:00:00Z", measurementsCm: { chest: 100 } },
      { date: "2026-04-15T00:00:00Z", weightKg: 70 },
      { date: "2026-05-01T00:00:00Z", measurementsCm: { chest: 102 } },
    ]);
    expect(out.chest?.latest.value).toBe(102);
    expect(out.chest?.previous?.value).toBe(100);
    expect(out.chest?.previous?.date).toBe("2026-04-01T00:00:00.000Z");
    expect(out.chest?.delta).toBe(2);

    // Weight has only one sample → no delta.
    expect(out.weightKg?.delta).toBeNull();
  });

  it("treats null and missing keys identically", () => {
    const withNull = summariseMetrics([
      { date: "2026-05-01T00:00:00Z", weightKg: null, bodyFatPercent: 18 },
      { date: "2026-05-08T00:00:00Z", weightKg: null, bodyFatPercent: 17 },
    ]);
    const withMissing = summariseMetrics([
      { date: "2026-05-01T00:00:00Z", bodyFatPercent: 18 },
      { date: "2026-05-08T00:00:00Z", bodyFatPercent: 17 },
    ]);
    expect(withNull.weightKg).toBeNull();
    expect(withMissing.weightKg).toBeNull();
    expect(withNull.bodyFatPercent?.delta).toBe(-1);
    expect(withMissing.bodyFatPercent?.delta).toBe(-1);
  });

  it("rounds delta to 3 decimals (no float fuzz)", () => {
    const out = summariseMetrics([
      { date: "2026-05-01T00:00:00Z", weightKg: 70.1 },
      { date: "2026-05-08T00:00:00Z", weightKg: 70.2 },
    ]);
    // 70.2 - 70.1 = 0.10000000000000142 in IEEE 754 — must round.
    expect(out.weightKg?.delta).toBe(0.1);
  });

  it("handles a Date instance for `date` (not just an ISO string)", () => {
    const out = summariseMetrics([
      { date: new Date("2026-05-01T00:00:00Z"), weightKg: 70 },
      { date: new Date("2026-05-08T00:00:00Z"), weightKg: 71 },
    ]);
    expect(out.weightKg?.delta).toBe(1);
  });

  it("more than two samples — uses only the latest two for delta", () => {
    const out = summariseMetrics([
      { date: "2026-04-01T00:00:00Z", weightKg: 75 },
      { date: "2026-04-15T00:00:00Z", weightKg: 72 },
      { date: "2026-05-01T00:00:00Z", weightKg: 70 },
    ]);
    expect(out.weightKg?.latest.value).toBe(70);
    expect(out.weightKg?.previous?.value).toBe(72);
    expect(out.weightKg?.delta).toBe(-2);
  });
});

describe("metricSeries", () => {
  it("returns an empty array when no entries have the metric", () => {
    expect(metricSeries([{ date: "2026-05-01T00:00:00Z", weightKg: 70 }], "chest")).toEqual([]);
  });

  it("returns the metric's points in chronological (oldest-first) order", () => {
    const entries: MeasurementEntryLike[] = [
      { date: "2026-05-08T00:00:00Z", weightKg: 71 },
      { date: "2026-05-01T00:00:00Z", weightKg: 72 },
      { date: "2026-05-15T00:00:00Z", weightKg: 70 },
    ];
    const out = metricSeries(entries, "weightKg");
    expect(out.map((p) => p.value)).toEqual([72, 71, 70]);
    expect(out[0]?.date).toBe("2026-05-01T00:00:00.000Z");
    expect(out[2]?.date).toBe("2026-05-15T00:00:00.000Z");
  });

  it("omits entries where the metric is null/missing", () => {
    const out = metricSeries(
      [
        { date: "2026-05-01T00:00:00Z", weightKg: 70, measurementsCm: { chest: 100 } },
        { date: "2026-05-08T00:00:00Z", weightKg: null, measurementsCm: { chest: 101 } },
        { date: "2026-05-15T00:00:00Z", weightKg: 71 },
      ],
      "chest",
    );
    expect(out).toHaveLength(2);
    expect(out.map((p) => p.value)).toEqual([100, 101]);
  });
});
