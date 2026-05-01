export const SERVING_UNITS = ["g", "ml", "piece", "cup", "tbsp", "tsp"] as const;
export type ServingUnit = (typeof SERVING_UNITS)[number];

export const FOOD_FILTERS = ["all", "favorites", "recent"] as const;
export type FoodFilter = (typeof FOOD_FILTERS)[number];
