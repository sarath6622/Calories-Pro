/**
 * PRD §4.7 — names of the eleven `measurementsCm` sub-fields, plus the two
 * top-level numeric metrics (`weightKg`, `bodyFatPercent`). Pure constants so
 * client components can import them without dragging Mongoose into the bundle
 * (same split pattern as `user-enums` and `food-enums`).
 */

export const CM_METRICS = [
  "chest",
  "waist",
  "hips",
  "leftBicep",
  "rightBicep",
  "leftThigh",
  "rightThigh",
  "leftCalf",
  "rightCalf",
  "neck",
  "shoulders",
] as const;

export type CmMetric = (typeof CM_METRICS)[number];

export const TOP_LEVEL_METRICS = ["weightKg", "bodyFatPercent"] as const;
export type TopLevelMetric = (typeof TOP_LEVEL_METRICS)[number];

export type Metric = TopLevelMetric | CmMetric;

export const ALL_METRICS: readonly Metric[] = [...TOP_LEVEL_METRICS, ...CM_METRICS];

export const METRIC_LABELS: Record<Metric, string> = {
  weightKg: "Weight",
  bodyFatPercent: "Body fat",
  chest: "Chest",
  waist: "Waist",
  hips: "Hips",
  leftBicep: "Left bicep",
  rightBicep: "Right bicep",
  leftThigh: "Left thigh",
  rightThigh: "Right thigh",
  leftCalf: "Left calf",
  rightCalf: "Right calf",
  neck: "Neck",
  shoulders: "Shoulders",
};

export const METRIC_UNITS: Record<Metric, string> = {
  weightKg: "kg",
  bodyFatPercent: "%",
  chest: "cm",
  waist: "cm",
  hips: "cm",
  leftBicep: "cm",
  rightBicep: "cm",
  leftThigh: "cm",
  rightThigh: "cm",
  leftCalf: "cm",
  rightCalf: "cm",
  neck: "cm",
  shoulders: "cm",
};
