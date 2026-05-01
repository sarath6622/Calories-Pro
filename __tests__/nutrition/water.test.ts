import { describe, expect, it } from "vitest";
import { DEFAULT_SLEEP_HOURS, WATER_ML_PER_KG, defaultWaterGoalMl } from "@/lib/nutrition/water";

describe("defaults", () => {
  it("uses 35 ml/kg for water (F-GOAL-5)", () => {
    expect(WATER_ML_PER_KG).toBe(35);
  });

  it("defaults sleep to 8 hours (F-GOAL-6)", () => {
    expect(DEFAULT_SLEEP_HOURS).toBe(8);
  });
});

describe("defaultWaterGoalMl", () => {
  it("multiplies weight by 35 and rounds", () => {
    expect(defaultWaterGoalMl(70)).toBe(2450);
    expect(defaultWaterGoalMl(82.5)).toBe(Math.round(82.5 * 35));
  });

  it("returns null for missing or non-positive weight", () => {
    expect(defaultWaterGoalMl(null)).toBeNull();
    expect(defaultWaterGoalMl(undefined)).toBeNull();
    expect(defaultWaterGoalMl(0)).toBeNull();
    expect(defaultWaterGoalMl(-5)).toBeNull();
  });
});
