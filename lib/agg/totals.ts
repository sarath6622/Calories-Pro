/**
 * Pure dashboard helpers — no DB, no React. These run on plain arrays so the
 * Phase 7 unit tests can pin behaviour without seeding Mongo.
 *
 * The "shape" types here are deliberately permissive (mirrors of `.toJSON()`
 * output from the log models) so the same helpers can consume both Mongoose
 * documents and the wire payload from `/api/...`.
 */

export interface FoodLogShape {
  date: string | Date;
  servings: number;
  snapshot: {
    caloriesPerServing: number;
    macrosPerServing: {
      proteinG: number;
      carbsG: number;
      fatG: number;
      fiberG: number | null;
      sugarG: number | null;
    };
  };
}

export interface ExerciseShape {
  date: string | Date;
  caloriesBurned: number;
}

export interface WaterShape {
  date: string | Date;
  amountMl: number;
}

export interface SleepShape {
  date: string | Date;
  durationMinutes: number;
  quality: number;
}

export interface WeightShape {
  date: string | Date;
  weightKg: number | null;
}

export interface MacroTotals {
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
}

export const ZERO_MACROS: MacroTotals = Object.freeze({
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  sugarG: 0,
});

/** Sum of `servings × snapshot.caloriesPerServing` across the entries. */
export function caloriesFromFoodEntries(entries: readonly FoodLogShape[]): number {
  let total = 0;
  for (const e of entries) {
    total += e.servings * e.snapshot.caloriesPerServing;
  }
  return round1(total);
}

/** Sum of `servings × snapshot.macrosPerServing.<m>` across the entries. */
export function macrosFromFoodEntries(entries: readonly FoodLogShape[]): MacroTotals {
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;
  let fiberG = 0;
  let sugarG = 0;
  for (const e of entries) {
    const s = e.servings;
    const m = e.snapshot.macrosPerServing;
    proteinG += s * m.proteinG;
    carbsG += s * m.carbsG;
    fatG += s * m.fatG;
    fiberG += s * (m.fiberG ?? 0);
    sugarG += s * (m.sugarG ?? 0);
  }
  return {
    proteinG: round1(proteinG),
    carbsG: round1(carbsG),
    fatG: round1(fatG),
    fiberG: round1(fiberG),
    sugarG: round1(sugarG),
  };
}

export function caloriesFromExerciseEntries(entries: readonly ExerciseShape[]): number {
  let total = 0;
  for (const e of entries) total += e.caloriesBurned;
  return round1(total);
}

export function waterFromEntries(entries: readonly WaterShape[]): number {
  let total = 0;
  for (const e of entries) total += e.amountMl;
  return total; // ml are integers per the Zod schema; no rounding needed
}

/** F-DSH-5: a daily calorie total is "within goal" iff |consumed − goal| ≤ goal × tolerance. */
export function withinGoalRange(consumed: number, goal: number, tolerance = 0.1): boolean {
  if (!Number.isFinite(goal) || goal <= 0) return false;
  if (!Number.isFinite(consumed) || consumed < 0) return false;
  return Math.abs(consumed - goal) <= goal * tolerance;
}

/**
 * F-DSH-2: "days within goal" — count of daily calorie totals where the user
 * landed inside ±tolerance of their daily calorie goal. Days with `0` calories
 * count as **not** within goal (a day with no food logged is a missing day,
 * not a "hit my goal of zero" day).
 */
export function daysWithinGoal(
  perDayCalories: readonly number[],
  goal: number,
  tolerance = 0.1,
): number {
  if (!Number.isFinite(goal) || goal <= 0) return 0;
  let n = 0;
  for (const c of perDayCalories) {
    if (c > 0 && withinGoalRange(c, goal, tolerance)) n += 1;
  }
  return n;
}

export interface AverageStats {
  count: number;
  average: number | null;
}

/** Mean of finite numbers; ignores nulls and non-finite. Empty input → null. */
export function averageOf(values: readonly (number | null | undefined)[]): AverageStats {
  let sum = 0;
  let count = 0;
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) {
      sum += v;
      count += 1;
    }
  }
  if (count === 0) return { count: 0, average: null };
  return { count, average: round1(sum / count) };
}

/** Latest sleep entry by `date`, or null when none. Ties broken by `durationMinutes`. */
export function latestSleep(entries: readonly SleepShape[]): SleepShape | null {
  let best: SleepShape | null = null;
  let bestT = -Infinity;
  for (const e of entries) {
    const t = new Date(e.date).getTime();
    if (t > bestT) {
      bestT = t;
      best = e;
    }
  }
  return best;
}

/** Latest measurement entry that has a non-null weightKg, or null when none. */
export function latestWeight(entries: readonly WeightShape[]): WeightShape | null {
  let best: WeightShape | null = null;
  let bestT = -Infinity;
  for (const e of entries) {
    if (typeof e.weightKg !== "number" || !Number.isFinite(e.weightKg)) continue;
    const t = new Date(e.date).getTime();
    if (t > bestT) {
      bestT = t;
      best = e;
    }
  }
  return best;
}

/**
 * Weight trend over a date range: `{start, end, delta}` using the **earliest
 * and latest** non-null weight in the supplied entries (any ordering ok).
 * Returns null when fewer than two weighed entries exist in the window.
 */
export interface WeightTrend {
  start: { date: string; weightKg: number };
  end: { date: string; weightKg: number };
  deltaKg: number;
}

export function weightTrend(entries: readonly WeightShape[]): WeightTrend | null {
  let earliest: WeightShape | null = null;
  let latest: WeightShape | null = null;
  let earliestT = Infinity;
  let latestT = -Infinity;
  for (const e of entries) {
    if (typeof e.weightKg !== "number" || !Number.isFinite(e.weightKg)) continue;
    const t = new Date(e.date).getTime();
    if (t < earliestT) {
      earliestT = t;
      earliest = e;
    }
    if (t > latestT) {
      latestT = t;
      latest = e;
    }
  }
  if (!earliest || !latest || earliest === latest) return null;
  return {
    start: { date: toIso(earliest.date), weightKg: earliest.weightKg as number },
    end: { date: toIso(latest.date), weightKg: latest.weightKg as number },
    deltaKg: round1((latest.weightKg as number) - (earliest.weightKg as number)),
  };
}

function toIso(d: string | Date): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
