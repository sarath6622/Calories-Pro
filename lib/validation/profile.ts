import { z } from "zod";
import {
  ACTIVITY_LEVELS,
  HEIGHT_UNITS,
  SEX_VALUES,
  WATER_UNITS,
  WEIGHT_UNITS,
} from "@/lib/models/user-enums";

const isoDateString = z
  .string()
  .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Invalid date");

export const ProfileUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  dateOfBirth: isoDateString.nullable().optional(),
  sex: z.enum(SEX_VALUES).optional(),
  heightCm: z
    .number({ invalid_type_error: "Height must be a number" })
    .positive()
    .max(300)
    .nullable()
    .optional(),
  activityLevel: z.enum(ACTIVITY_LEVELS).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  units: z
    .object({
      weight: z.enum(WEIGHT_UNITS),
      height: z.enum(HEIGHT_UNITS),
      water: z.enum(WATER_UNITS),
    })
    .optional(),
});
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;
