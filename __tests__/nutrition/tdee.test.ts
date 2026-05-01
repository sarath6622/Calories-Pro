import { describe, expect, it } from "vitest";
import { ACTIVITY_MULTIPLIERS, tdee } from "@/lib/nutrition/tdee";

describe("ACTIVITY_MULTIPLIERS", () => {
  it("matches the F-GOAL-2 PRD constants", () => {
    expect(ACTIVITY_MULTIPLIERS).toEqual({
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9,
    });
  });
});

describe("tdee()", () => {
  it("multiplies BMR by the selected activity factor and rounds", () => {
    expect(tdee(1500, "sedentary")).toBe(Math.round(1500 * 1.2));
    expect(tdee(1500, "light")).toBe(Math.round(1500 * 1.375));
    expect(tdee(1500, "moderate")).toBe(Math.round(1500 * 1.55));
    expect(tdee(1500, "active")).toBe(Math.round(1500 * 1.725));
    expect(tdee(1500, "very_active")).toBe(Math.round(1500 * 1.9));
  });

  it("returns null when BMR is null", () => {
    expect(tdee(null, "moderate")).toBeNull();
  });

  it("returns null when BMR is non-positive", () => {
    expect(tdee(0, "moderate")).toBeNull();
    expect(tdee(-100, "moderate")).toBeNull();
  });
});
