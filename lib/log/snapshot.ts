import type { FoodDocument } from "@/lib/models/Food";

export interface FoodSnapshot {
  name: string;
  caloriesPerServing: number;
  macrosPerServing: {
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number | null;
    sugarG: number | null;
  };
}

/**
 * PRD §4.3 snapshot invariant. Build a frozen copy of a food's nutrition at
 * log time so that later edits to the source `Food` never mutate historical
 * `FoodLogEntry` rows.
 *
 * The function takes a plain object (not the live Mongoose doc) so callers
 * can pass `food.toObject()` — that decouples the snapshot from any future
 * pre-save hooks Mongoose grows.
 */
export function buildFoodSnapshot(
  food: Pick<FoodDocument, "name" | "caloriesPerServing" | "macrosPerServing">,
): FoodSnapshot {
  return {
    name: food.name,
    caloriesPerServing: food.caloriesPerServing,
    macrosPerServing: {
      proteinG: food.macrosPerServing.proteinG,
      carbsG: food.macrosPerServing.carbsG,
      fatG: food.macrosPerServing.fatG,
      fiberG: food.macrosPerServing.fiberG ?? null,
      sugarG: food.macrosPerServing.sugarG ?? null,
    },
  };
}
