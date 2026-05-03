import { describe, expect, it } from "vitest";
import {
  MeasurementCreateSchema,
  MeasurementUpdateSchema,
} from "@/lib/validation/measurement";

const baseDate = "2026-05-03";

describe("MeasurementCreateSchema", () => {
  it("accepts a weight-only payload", () => {
    const out = MeasurementCreateSchema.parse({ date: baseDate, weightKg: 70.5 });
    expect(out.weightKg).toBe(70.5);
  });

  it("accepts a circumference-only payload", () => {
    const out = MeasurementCreateSchema.parse({
      date: baseDate,
      measurementsCm: { chest: 100 },
    });
    expect(out.measurementsCm?.chest).toBe(100);
  });

  it("rejects an entry with no numeric metrics (just a date and a note)", () => {
    const out = MeasurementCreateSchema.safeParse({ date: baseDate, note: "felt fine" });
    expect(out.success).toBe(false);
  });

  it("rejects an entry with measurementsCm present but every field nulled", () => {
    const out = MeasurementCreateSchema.safeParse({
      date: baseDate,
      measurementsCm: { chest: null, waist: null },
    });
    expect(out.success).toBe(false);
  });

  it("rejects negative weight", () => {
    const out = MeasurementCreateSchema.safeParse({ date: baseDate, weightKg: -1 });
    expect(out.success).toBe(false);
  });

  it("rejects zero weight (positive only)", () => {
    const out = MeasurementCreateSchema.safeParse({ date: baseDate, weightKg: 0 });
    expect(out.success).toBe(false);
  });

  it("rejects body fat above 100", () => {
    const out = MeasurementCreateSchema.safeParse({ date: baseDate, bodyFatPercent: 101 });
    expect(out.success).toBe(false);
  });

  it("accepts body fat at the 0 / 100 boundaries", () => {
    expect(MeasurementCreateSchema.safeParse({ date: baseDate, bodyFatPercent: 0, weightKg: 70 }).success).toBe(true);
    expect(MeasurementCreateSchema.safeParse({ date: baseDate, bodyFatPercent: 100, weightKg: 70 }).success).toBe(true);
  });

  it("rejects malformed date", () => {
    const out = MeasurementCreateSchema.safeParse({ date: "2026/05/03", weightKg: 70 });
    expect(out.success).toBe(false);
  });

  it("rejects unknown extras at the top level (strict)", () => {
    const out = MeasurementCreateSchema.safeParse({
      date: baseDate,
      weightKg: 70,
      userId: "abc",
    } as never);
    expect(out.success).toBe(false);
  });

  it("rejects unknown extras inside measurementsCm (strict)", () => {
    const out = MeasurementCreateSchema.safeParse({
      date: baseDate,
      measurementsCm: { chest: 100, ankle: 25 },
    } as never);
    expect(out.success).toBe(false);
  });

  it("accepts a multi-circumference payload", () => {
    const out = MeasurementCreateSchema.parse({
      date: baseDate,
      measurementsCm: { chest: 100, waist: 80, hips: 95 },
    });
    expect(out.measurementsCm).toEqual({ chest: 100, waist: 80, hips: 95 });
  });

  it("accepts an explicit null for an optional metric (skip that one)", () => {
    const out = MeasurementCreateSchema.parse({
      date: baseDate,
      weightKg: 70,
      bodyFatPercent: null,
    });
    expect(out.bodyFatPercent).toBeNull();
  });
});

describe("MeasurementUpdateSchema", () => {
  it("accepts a single-field PATCH (note only)", () => {
    const out = MeasurementUpdateSchema.parse({ note: "morning weigh-in" });
    expect(out.note).toBe("morning weigh-in");
  });

  it("accepts a date-only PATCH (relabeling the day)", () => {
    const out = MeasurementUpdateSchema.parse({ date: baseDate });
    expect(out.date).toBe(baseDate);
  });

  it("accepts a weight-clearing PATCH (explicit null)", () => {
    const out = MeasurementUpdateSchema.parse({ weightKg: null });
    expect(out.weightKg).toBeNull();
  });

  it("rejects an empty PATCH body (no fields at all)", () => {
    const out = MeasurementUpdateSchema.safeParse({});
    expect(out.success).toBe(false);
  });

  it("rejects unknown extras (strict)", () => {
    const out = MeasurementUpdateSchema.safeParse({ weightKg: 70, photos: ["x"] } as never);
    expect(out.success).toBe(false);
  });

  it("rejects an attempt to set userId via PATCH", () => {
    const out = MeasurementUpdateSchema.safeParse({ weightKg: 70, userId: "abc" } as never);
    expect(out.success).toBe(false);
  });
});
