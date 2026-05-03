import { describe, expect, it } from "vitest";
import { WaterCreateSchema } from "@/lib/validation/water-log";

const valid = { date: "2026-05-03", amountMl: 250 };

describe("WaterCreateSchema", () => {
  it("accepts a valid payload", () => {
    expect(WaterCreateSchema.parse(valid)).toEqual(valid);
  });

  it("rejects zero or negative amounts", () => {
    expect(WaterCreateSchema.safeParse({ ...valid, amountMl: 0 }).success).toBe(false);
    expect(WaterCreateSchema.safeParse({ ...valid, amountMl: -100 }).success).toBe(false);
  });

  it("rejects fractional amounts (must be whole millilitres)", () => {
    expect(WaterCreateSchema.safeParse({ ...valid, amountMl: 250.5 }).success).toBe(false);
  });

  it("rejects malformed dates", () => {
    expect(WaterCreateSchema.safeParse({ ...valid, date: "2026/05/03" }).success).toBe(false);
    expect(WaterCreateSchema.safeParse({ ...valid, date: "2026-13-01" }).success).toBe(false);
  });

  it("rejects unknown extras (strict)", () => {
    expect(WaterCreateSchema.safeParse({ ...valid, sneaky: 1 } as never).success).toBe(false);
  });

  it("rejects implausibly large amounts", () => {
    expect(WaterCreateSchema.safeParse({ ...valid, amountMl: 100_000 }).success).toBe(false);
  });
});
