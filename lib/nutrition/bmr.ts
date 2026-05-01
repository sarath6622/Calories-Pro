import type { Sex } from "@/lib/models/user-enums";

export interface BmrInput {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: Sex;
}

export function ageInYears(dateOfBirth: Date, now: Date = new Date()): number {
  const diffMs = now.getTime() - dateOfBirth.getTime();
  const ageMs = diffMs > 0 ? diffMs : 0;
  return Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
}

/**
 * Mifflin-St Jeor BMR (kcal/day).
 * Returns null when sex is "other" because the equation is not defined for it
 * (F-GOAL-3 lets the user override the daily calorie goal manually).
 */
export function bmr({ weightKg, heightCm, ageYears, sex }: BmrInput): number | null {
  if (weightKg <= 0 || heightCm <= 0 || ageYears < 0) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  if (sex === "male") return base + 5;
  if (sex === "female") return base - 161;
  return null;
}
