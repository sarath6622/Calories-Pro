import { z } from "zod";
import { MEAL_TYPES } from "@/lib/log/meal-type";

const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid id");

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()), "Invalid date");

const servingsSchema = z
  .number({ invalid_type_error: "Servings must be a number" })
  .positive("Servings must be greater than zero")
  .max(1000, "Too many servings");

export const FoodLogCreateSchema = z
  .object({
    foodId: objectIdSchema,
    date: isoDateSchema,
    mealType: z.enum(MEAL_TYPES),
    servings: servingsSchema,
  })
  .strict();
export type FoodLogCreateInput = z.infer<typeof FoodLogCreateSchema>;

export const FoodLogUpdateSchema = z
  .object({
    servings: servingsSchema,
  })
  .strict();
export type FoodLogUpdateInput = z.infer<typeof FoodLogUpdateSchema>;
