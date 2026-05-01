import { z } from "zod";
import { SERVING_UNITS } from "@/lib/models/food-enums";

const positiveNumber = z
  .number({ invalid_type_error: "Must be a number" })
  .nonnegative("Must be zero or greater");

const macrosSchema = z.object({
  proteinG: positiveNumber.max(1000),
  carbsG: positiveNumber.max(2000),
  fatG: positiveNumber.max(1000),
  fiberG: positiveNumber.max(1000).nullable().optional(),
  sugarG: positiveNumber.max(1000).nullable().optional(),
});

export const FoodCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(160),
    brand: z.string().trim().max(120).nullable().optional(),
    servingSize: z
      .number({ invalid_type_error: "Serving size must be a number" })
      .positive("Serving size must be greater than zero"),
    servingUnit: z.enum(SERVING_UNITS),
    caloriesPerServing: positiveNumber.max(20000),
    macrosPerServing: macrosSchema,
    isFavorite: z.boolean().optional(),
  })
  .strict();
export type FoodCreateInput = z.infer<typeof FoodCreateSchema>;

export const FoodUpdateSchema = FoodCreateSchema.partial().strict();
export type FoodUpdateInput = z.infer<typeof FoodUpdateSchema>;
