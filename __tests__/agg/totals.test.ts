import { describe, expect, it } from "vitest";
import {
  averageOf,
  caloriesFromExerciseEntries,
  caloriesFromFoodEntries,
  daysWithinGoal,
  latestSleep,
  latestWeight,
  macrosFromFoodEntries,
  waterFromEntries,
  weightTrend,
  withinGoalRange,
  type FoodLogShape,
} from "@/lib/agg/totals";

function food(
  servings: number,
  cal: number,
  macros: Partial<{
    p: number;
    c: number;
    f: number;
    fib: number | null;
    sug: number | null;
  }> = {},
): FoodLogShape {
  return {
    date: "2026-05-01",
    servings,
    snapshot: {
      caloriesPerServing: cal,
      macrosPerServing: {
        proteinG: macros.p ?? 0,
        carbsG: macros.c ?? 0,
        fatG: macros.f ?? 0,
        fiberG: macros.fib === undefined ? null : macros.fib,
        sugarG: macros.sug === undefined ? null : macros.sug,
      },
    },
  };
}

describe("caloriesFromFoodEntries", () => {
  it("sums servings × caloriesPerServing across entries", () => {
    expect(caloriesFromFoodEntries([food(1, 100), food(2, 50)])).toBe(200);
  });

  it("returns 0 for an empty array", () => {
    expect(caloriesFromFoodEntries([])).toBe(0);
  });

  it("rounds to 1 decimal to avoid float fuzz", () => {
    // 0.1 × 100 + 0.2 × 100 = 30 (would print as 30.000000000000004 untouched).
    expect(caloriesFromFoodEntries([food(0.1, 100), food(0.2, 100)])).toBe(30);
  });

  it("respects fractional servings", () => {
    expect(caloriesFromFoodEntries([food(1.5, 200)])).toBe(300);
  });
});

describe("macrosFromFoodEntries", () => {
  it("treats nullable fiberG / sugarG as 0 in the sum", () => {
    const out = macrosFromFoodEntries([
      food(1, 100, { p: 10, c: 20, f: 5, fib: 3, sug: null }),
      food(2, 50, { p: 4, c: 6, f: 1 }),
    ]);
    expect(out.proteinG).toBe(18);
    expect(out.carbsG).toBe(32);
    expect(out.fatG).toBe(7);
    expect(out.fiberG).toBe(3);
    expect(out.sugarG).toBe(0);
  });

  it("returns all zeros for empty input", () => {
    expect(macrosFromFoodEntries([])).toEqual({
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      fiberG: 0,
      sugarG: 0,
    });
  });
});

describe("caloriesFromExerciseEntries", () => {
  it("sums caloriesBurned per F-EX-2 (multiple per day)", () => {
    expect(
      caloriesFromExerciseEntries([
        { date: "2026-05-01", caloriesBurned: 250 },
        { date: "2026-05-01", caloriesBurned: 100 },
      ]),
    ).toBe(350);
  });

  it("returns 0 on empty input", () => {
    expect(caloriesFromExerciseEntries([])).toBe(0);
  });
});

describe("waterFromEntries", () => {
  it("sums amountMl integers exactly without rounding drift", () => {
    expect(
      waterFromEntries([
        { date: "2026-05-01", amountMl: 250 },
        { date: "2026-05-01", amountMl: 500 },
        { date: "2026-05-01", amountMl: 350 },
      ]),
    ).toBe(1100);
  });
});

describe("withinGoalRange (F-DSH-5)", () => {
  it("accepts values within ±10% of the goal", () => {
    expect(withinGoalRange(2000, 2000)).toBe(true);
    expect(withinGoalRange(1801, 2000)).toBe(true);
    expect(withinGoalRange(2199, 2000)).toBe(true);
    // Boundaries: exactly 10% away passes (≤, not <).
    expect(withinGoalRange(1800, 2000)).toBe(true);
    expect(withinGoalRange(2200, 2000)).toBe(true);
  });

  it("rejects values outside the ±10% band", () => {
    expect(withinGoalRange(1799, 2000)).toBe(false);
    expect(withinGoalRange(2201, 2000)).toBe(false);
  });

  it("returns false when the goal is missing or zero", () => {
    expect(withinGoalRange(0, 0)).toBe(false);
    expect(withinGoalRange(2000, 0)).toBe(false);
    expect(withinGoalRange(2000, -100)).toBe(false);
  });

  it("respects a custom tolerance", () => {
    expect(withinGoalRange(2050, 2000, 0.05)).toBe(true);
    expect(withinGoalRange(2150, 2000, 0.05)).toBe(false);
  });
});

describe("daysWithinGoal (F-DSH-2)", () => {
  it("counts only days with calories > 0 inside the band", () => {
    expect(daysWithinGoal([2000, 1900, 0, 2300], 2000)).toBe(2);
  });

  it("a day with zero calories does NOT count even if 0 is within the band of a tiny goal", () => {
    // Defensive: a missing log is not a "hit my goal" day.
    expect(daysWithinGoal([0, 0, 0], 2000)).toBe(0);
  });

  it("returns 0 when goal is unset", () => {
    expect(daysWithinGoal([2000, 2000], 0)).toBe(0);
  });
});

describe("averageOf", () => {
  it("ignores null/undefined and returns null for an all-null input", () => {
    expect(averageOf([null, undefined])).toEqual({ count: 0, average: null });
  });

  it("computes the mean of numeric entries", () => {
    expect(averageOf([10, 20, 30])).toEqual({ count: 3, average: 20 });
  });

  it("rounds to 1 decimal", () => {
    expect(averageOf([1, 2])).toEqual({ count: 2, average: 1.5 });
  });
});

describe("latestSleep", () => {
  it("picks the entry with the largest date", () => {
    const out = latestSleep([
      { date: "2026-04-30", durationMinutes: 420, quality: 3 },
      { date: "2026-05-01", durationMinutes: 480, quality: 4 },
      { date: "2026-04-29", durationMinutes: 510, quality: 5 },
    ]);
    expect(out?.durationMinutes).toBe(480);
  });

  it("returns null on empty input", () => {
    expect(latestSleep([])).toBeNull();
  });
});

describe("latestWeight", () => {
  it("ignores entries with null weightKg", () => {
    const out = latestWeight([
      { date: "2026-05-01", weightKg: null },
      { date: "2026-04-25", weightKg: 70.2 },
      { date: "2026-04-20", weightKg: 71 },
    ]);
    expect(out?.weightKg).toBe(70.2);
  });

  it("returns null when no weighed entry exists", () => {
    expect(latestWeight([{ date: "2026-05-01", weightKg: null }])).toBeNull();
  });
});

describe("weightTrend", () => {
  it("returns earliest, latest and signed delta across the window", () => {
    const out = weightTrend([
      { date: "2026-04-15", weightKg: 72 },
      { date: "2026-05-01", weightKg: 70.4 },
      { date: "2026-04-20", weightKg: 71 },
    ]);
    expect(out?.start.weightKg).toBe(72);
    expect(out?.end.weightKg).toBe(70.4);
    expect(out?.deltaKg).toBe(-1.6);
  });

  it("returns null with fewer than two weighed entries", () => {
    expect(weightTrend([{ date: "2026-05-01", weightKg: 70 }])).toBeNull();
    expect(
      weightTrend([
        { date: "2026-05-01", weightKg: 70 },
        { date: "2026-05-02", weightKg: null },
      ]),
    ).toBeNull();
  });
});
