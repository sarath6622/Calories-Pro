export const MACRO_PRESETS = ["balanced", "high_protein", "low_carb", "custom"] as const;
export type MacroPreset = (typeof MACRO_PRESETS)[number];

export interface MacroSplit {
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
}

export const MACRO_PRESET_SPLITS: Record<Exclude<MacroPreset, "custom">, MacroSplit> = {
  balanced: { proteinPct: 30, carbsPct: 40, fatPct: 30 },
  high_protein: { proteinPct: 40, carbsPct: 30, fatPct: 30 },
  low_carb: { proteinPct: 35, carbsPct: 25, fatPct: 40 },
};

export interface MacroGrams {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 };

export function macroGramsFromPreset(
  dailyCalories: number,
  preset: Exclude<MacroPreset, "custom">,
): MacroGrams {
  const split = MACRO_PRESET_SPLITS[preset];
  return {
    proteinG: Math.round((dailyCalories * (split.proteinPct / 100)) / KCAL_PER_GRAM.protein),
    carbsG: Math.round((dailyCalories * (split.carbsPct / 100)) / KCAL_PER_GRAM.carbs),
    fatG: Math.round((dailyCalories * (split.fatPct / 100)) / KCAL_PER_GRAM.fat),
  };
}

export function caloriesFromMacros({ proteinG, carbsG, fatG }: MacroGrams): number {
  return Math.round(
    proteinG * KCAL_PER_GRAM.protein + carbsG * KCAL_PER_GRAM.carbs + fatG * KCAL_PER_GRAM.fat,
  );
}
