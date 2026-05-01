export const WATER_ML_PER_KG = 35;
export const DEFAULT_SLEEP_HOURS = 8;

/** F-GOAL-5: 35 ml per kg body weight. Returns null when weight is missing. */
export function defaultWaterGoalMl(weightKg: number | null | undefined): number | null {
  if (weightKg == null || weightKg <= 0) return null;
  return Math.round(weightKg * WATER_ML_PER_KG);
}
