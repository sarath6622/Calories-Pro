import type { ActivityLevel } from "@/lib/models/user-enums";

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function tdee(bmrKcal: number | null, activityLevel: ActivityLevel): number | null {
  if (bmrKcal === null || bmrKcal <= 0) return null;
  return Math.round(bmrKcal * ACTIVITY_MULTIPLIERS[activityLevel]);
}
