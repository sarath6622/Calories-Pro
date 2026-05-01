import { z } from "zod";
import { MACRO_PRESETS } from "@/lib/nutrition/macros";

const positiveInt = z
  .number({ invalid_type_error: "Must be a number" })
  .int("Must be a whole number")
  .nonnegative("Must be zero or greater");

export const GoalsUpdateSchema = z
  .object({
    dailyCalories: positiveInt.max(20000),
    dailyProteinG: positiveInt.max(1000),
    dailyCarbsG: positiveInt.max(2000),
    dailyFatG: positiveInt.max(1000),
    dailyWaterMl: positiveInt.max(20000),
    sleepHoursTarget: z
      .number({ invalid_type_error: "Must be a number" })
      .min(0)
      .max(24),
    targetWeightKg: z
      .number({ invalid_type_error: "Must be a number" })
      .positive()
      .max(500)
      .nullable()
      .optional(),
    macroPreset: z.enum(MACRO_PRESETS),
  })
  .strict();
export type GoalsUpdateInput = z.infer<typeof GoalsUpdateSchema>;
