import { z } from "zod";

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()), "Invalid date");

const caloriesBurnedSchema = z
  .number({ invalid_type_error: "Calories burned must be a number" })
  .nonnegative("Calories burned cannot be negative")
  .max(20_000, "Too many calories");

const noteSchema = z.string().trim().max(500, "Note is too long").nullable().optional();

export const ExerciseCreateSchema = z
  .object({
    date: isoDateSchema,
    caloriesBurned: caloriesBurnedSchema,
    note: noteSchema,
  })
  .strict();
export type ExerciseCreateInput = z.infer<typeof ExerciseCreateSchema>;

export const ExerciseUpdateSchema = z
  .object({
    caloriesBurned: caloriesBurnedSchema.optional(),
    note: noteSchema,
  })
  .strict()
  .refine((v) => v.caloriesBurned !== undefined || v.note !== undefined, {
    message: "At least one of `caloriesBurned` or `note` must be provided",
  });
export type ExerciseUpdateInput = z.infer<typeof ExerciseUpdateSchema>;
