export const SEX_VALUES = ["male", "female", "other"] as const;
export type Sex = (typeof SEX_VALUES)[number];

export const ACTIVITY_LEVELS = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const WEIGHT_UNITS = ["kg", "lb"] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

export const HEIGHT_UNITS = ["cm", "ft"] as const;
export type HeightUnit = (typeof HEIGHT_UNITS)[number];

export const WATER_UNITS = ["ml", "fl_oz"] as const;
export type WaterUnit = (typeof WATER_UNITS)[number];

export const ROLES = ["user", "admin"] as const;
export type Role = (typeof ROLES)[number];
