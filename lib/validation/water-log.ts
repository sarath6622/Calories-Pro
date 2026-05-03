import { z } from "zod";

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()), "Invalid date");

const amountSchema = z
  .number({ invalid_type_error: "Amount must be a number" })
  .int("Amount must be a whole number of millilitres")
  .positive("Amount must be greater than zero")
  .max(10_000, "Too much water in one entry");

export const WaterCreateSchema = z
  .object({
    date: isoDateSchema,
    amountMl: amountSchema,
  })
  .strict();
export type WaterCreateInput = z.infer<typeof WaterCreateSchema>;
