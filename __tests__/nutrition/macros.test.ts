import { describe, expect, it } from "vitest";
import {
  MACRO_PRESET_SPLITS,
  caloriesFromMacros,
  macroGramsFromPreset,
} from "@/lib/nutrition/macros";

describe("MACRO_PRESET_SPLITS", () => {
  it("matches the F-GOAL-4 PRD splits (P / C / F)", () => {
    expect(MACRO_PRESET_SPLITS.balanced).toEqual({ proteinPct: 30, carbsPct: 40, fatPct: 30 });
    expect(MACRO_PRESET_SPLITS.high_protein).toEqual({ proteinPct: 40, carbsPct: 30, fatPct: 30 });
    expect(MACRO_PRESET_SPLITS.low_carb).toEqual({ proteinPct: 35, carbsPct: 25, fatPct: 40 });
  });
});

describe("macroGramsFromPreset", () => {
  it("converts kcal -> grams using 4/4/9 kcal per g", () => {
    // 2000 kcal balanced 30/40/30
    // protein: 600 kcal / 4 = 150g
    // carbs:   800 kcal / 4 = 200g
    // fat:     600 kcal / 9 = 67g (rounded)
    expect(macroGramsFromPreset(2000, "balanced")).toEqual({
      proteinG: 150,
      carbsG: 200,
      fatG: Math.round(600 / 9),
    });
  });

  it("respects each preset", () => {
    // 1800 high_protein 40/30/30 -> 180/135/60
    expect(macroGramsFromPreset(1800, "high_protein")).toEqual({
      proteinG: 180,
      carbsG: Math.round(540 / 4),
      fatG: 60,
    });
    // 2200 low_carb 35/25/40 -> 192.5/137.5/97.7
    expect(macroGramsFromPreset(2200, "low_carb")).toEqual({
      proteinG: Math.round(770 / 4),
      carbsG: Math.round(550 / 4),
      fatG: Math.round(880 / 9),
    });
  });
});

describe("caloriesFromMacros", () => {
  it("uses 4/4/9 kcal/g and rounds", () => {
    expect(caloriesFromMacros({ proteinG: 150, carbsG: 200, fatG: 67 })).toBe(
      150 * 4 + 200 * 4 + 67 * 9,
    );
  });
});
