import { z } from "zod";

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()), "Invalid date");

const isoDateTimeSchema = z
  .string()
  .refine((s) => !Number.isNaN(new Date(s).getTime()), "Invalid datetime");

const qualitySchema = z
  .number({ invalid_type_error: "Quality must be a number" })
  .int("Quality must be 1–5")
  .min(1, "Quality must be 1–5")
  .max(5, "Quality must be 1–5");

const noteSchema = z.string().trim().max(500, "Note is too long").nullable().optional();

export const SleepCreateSchema = z
  .object({
    date: isoDateSchema,
    bedtime: isoDateTimeSchema,
    wakeTime: isoDateTimeSchema,
    quality: qualitySchema,
    note: noteSchema,
  })
  .strict()
  .refine((v) => new Date(v.wakeTime).getTime() > new Date(v.bedtime).getTime(), {
    message: "wakeTime must be after bedtime",
    path: ["wakeTime"],
  });
export type SleepCreateInput = z.infer<typeof SleepCreateSchema>;

export const SleepUpdateSchema = z
  .object({
    bedtime: isoDateTimeSchema.optional(),
    wakeTime: isoDateTimeSchema.optional(),
    quality: qualitySchema.optional(),
    note: noteSchema,
  })
  .strict()
  .refine(
    (v) =>
      v.bedtime !== undefined ||
      v.wakeTime !== undefined ||
      v.quality !== undefined ||
      v.note !== undefined,
    { message: "At least one field must be provided" },
  )
  .refine(
    (v) => {
      if (v.bedtime !== undefined && v.wakeTime !== undefined) {
        return new Date(v.wakeTime).getTime() > new Date(v.bedtime).getTime();
      }
      return true;
    },
    { message: "wakeTime must be after bedtime", path: ["wakeTime"] },
  );
export type SleepUpdateInput = z.infer<typeof SleepUpdateSchema>;
