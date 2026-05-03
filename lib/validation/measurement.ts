import { z } from "zod";
import { CM_METRICS } from "@/lib/models/measurement-enums";

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()), "Invalid date");

/**
 * A "measurement value" — a positive finite number, OR `null`/`undefined` to
 * skip the metric entirely. Per F-BM-1 every numeric field is optional so the
 * user only logs what they want that day. We accept `null` (explicit "clear"
 * on PATCH) and `undefined` (omit the key) interchangeably.
 */
const measurementValueSchema = z
  .number({ invalid_type_error: "Must be a number" })
  .positive("Must be positive")
  .finite("Must be a finite number")
  .nullable()
  .optional();

const bodyFatSchema = z
  .number({ invalid_type_error: "Must be a number" })
  .min(0, "Body fat must be ≥ 0")
  .max(100, "Body fat must be ≤ 100")
  .nullable()
  .optional();

const noteSchema = z.string().trim().max(500, "Note is too long").nullable().optional();

const measurementsCmSchema = z
  .object(
    Object.fromEntries(CM_METRICS.map((m) => [m, measurementValueSchema])) as Record<
      (typeof CM_METRICS)[number],
      typeof measurementValueSchema
    >,
  )
  .strict()
  .optional();

/**
 * Returns true if at least one numeric metric has a non-null value somewhere
 * in the payload. A measurement entry with no numbers is meaningless (just a
 * date and maybe a note), so create / update both reject it.
 */
function hasAnyNumericMetric(v: {
  weightKg?: number | null;
  bodyFatPercent?: number | null;
  measurementsCm?: Partial<Record<(typeof CM_METRICS)[number], number | null | undefined>>;
}): boolean {
  if (typeof v.weightKg === "number") return true;
  if (typeof v.bodyFatPercent === "number") return true;
  if (v.measurementsCm) {
    for (const m of CM_METRICS) {
      if (typeof v.measurementsCm[m] === "number") return true;
    }
  }
  return false;
}

export const MeasurementCreateSchema = z
  .object({
    date: isoDateSchema,
    weightKg: measurementValueSchema,
    bodyFatPercent: bodyFatSchema,
    measurementsCm: measurementsCmSchema,
    note: noteSchema,
  })
  .strict()
  .refine(hasAnyNumericMetric, {
    message: "Provide at least one measurement (weight, body fat, or a circumference)",
    path: ["weightKg"],
  });
export type MeasurementCreateInput = z.infer<typeof MeasurementCreateSchema>;

export const MeasurementUpdateSchema = z
  .object({
    date: isoDateSchema.optional(),
    weightKg: measurementValueSchema,
    bodyFatPercent: bodyFatSchema,
    measurementsCm: measurementsCmSchema,
    note: noteSchema,
  })
  .strict()
  .refine(
    (v) =>
      v.date !== undefined ||
      v.weightKg !== undefined ||
      v.bodyFatPercent !== undefined ||
      v.measurementsCm !== undefined ||
      v.note !== undefined,
    { message: "At least one field must be provided" },
  );
export type MeasurementUpdateInput = z.infer<typeof MeasurementUpdateSchema>;
