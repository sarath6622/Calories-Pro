import { describe, expect, it } from "vitest";
import { GoalsUpdateSchema } from "@/lib/validation/goals";

const baseValid = {
  dailyCalories: 2000,
  dailyProteinG: 150,
  dailyCarbsG: 200,
  dailyFatG: 67,
  dailyWaterMl: 2500,
  sleepHoursTarget: 8,
  targetWeightKg: 70,
  macroPreset: "balanced" as const,
};

describe("GoalsUpdateSchema", () => {
  it("accepts a valid payload", () => {
    expect(GoalsUpdateSchema.parse(baseValid)).toEqual(baseValid);
  });

  it("rejects negative numbers", () => {
    expect(GoalsUpdateSchema.safeParse({ ...baseValid, dailyCalories: -1 }).success).toBe(false);
    expect(GoalsUpdateSchema.safeParse({ ...baseValid, dailyWaterMl: -100 }).success).toBe(false);
  });

  it("rejects non-integer macro grams", () => {
    expect(GoalsUpdateSchema.safeParse({ ...baseValid, dailyProteinG: 100.5 }).success).toBe(false);
  });

  it("rejects unknown macro presets", () => {
    expect(
      GoalsUpdateSchema.safeParse({ ...baseValid, macroPreset: "keto" as never }).success,
    ).toBe(false);
  });

  it("accepts null targetWeightKg", () => {
    expect(GoalsUpdateSchema.parse({ ...baseValid, targetWeightKg: null }).targetWeightKg).toBeNull();
  });

  it("rejects sleep target outside 0..24", () => {
    expect(GoalsUpdateSchema.safeParse({ ...baseValid, sleepHoursTarget: 30 }).success).toBe(false);
    expect(GoalsUpdateSchema.safeParse({ ...baseValid, sleepHoursTarget: -1 }).success).toBe(false);
  });

  it("rejects unknown extra keys (strict)", () => {
    expect(
      GoalsUpdateSchema.safeParse({ ...baseValid, sneakyExtra: "no" } as never).success,
    ).toBe(false);
  });
});
