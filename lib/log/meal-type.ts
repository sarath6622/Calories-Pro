export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

/**
 * F-LOG-2 default meal type by local time.
 * 04:00–10:30 breakfast, 10:30–15:00 lunch, 15:00–18:00 snack, 18:00–04:00 dinner.
 */
export function defaultMealType(now: Date = new Date()): MealType {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes >= 4 * 60 && minutes < 10 * 60 + 30) return "breakfast";
  if (minutes >= 10 * 60 + 30 && minutes < 15 * 60) return "lunch";
  if (minutes >= 15 * 60 && minutes < 18 * 60) return "snack";
  return "dinner";
}

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export const MEAL_TYPE_ORDER: readonly MealType[] = ["breakfast", "lunch", "snack", "dinner"];
