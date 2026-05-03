/**
 * MongoDB aggregation pipelines for the dashboard. Each builder returns a
 * vanilla pipeline array so it stays unit-testable in isolation; the runner
 * wrappers below execute them on the model with the standard `userId` scoping
 * (project rule #4 — always scope by `userId`).
 *
 * Per-day aggregations group on `$date` (stored as midnight UTC in PRD §4.3
 * convention) so a calendar day is a single bucket regardless of what time of
 * day the user logged.
 */

import mongoose, { type PipelineStage } from "mongoose";
import { ExerciseEntry } from "@/lib/models/ExerciseEntry";
import { FoodLogEntry } from "@/lib/models/FoodLogEntry";
import { SleepEntry } from "@/lib/models/SleepEntry";
import { WaterLogEntry } from "@/lib/models/WaterLogEntry";
import { BodyMeasurementEntry } from "@/lib/models/BodyMeasurementEntry";

function userOid(userId: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(userId);
}

function dateRangeMatch(userId: string, from: Date, to: Date): PipelineStage.Match {
  return { $match: { userId: userOid(userId), date: { $gte: from, $lte: to } } };
}

/** Per-day food calories + macros summed across all FoodLogEntry rows in range. */
export function dailyFoodPipeline(userId: string, from: Date, to: Date): PipelineStage[] {
  return [
    dateRangeMatch(userId, from, to),
    {
      $group: {
        _id: "$date",
        calories: {
          $sum: { $multiply: ["$snapshot.caloriesPerServing", "$servings"] },
        },
        proteinG: {
          $sum: { $multiply: ["$snapshot.macrosPerServing.proteinG", "$servings"] },
        },
        carbsG: {
          $sum: { $multiply: ["$snapshot.macrosPerServing.carbsG", "$servings"] },
        },
        fatG: {
          $sum: { $multiply: ["$snapshot.macrosPerServing.fatG", "$servings"] },
        },
        // fiberG / sugarG are nullable per PRD §4.3, treat null as 0 so a missing
        // value doesn't blow up the $sum (Mongo's $sum is null-safe but $multiply isn't).
        fiberG: {
          $sum: {
            $multiply: [{ $ifNull: ["$snapshot.macrosPerServing.fiberG", 0] }, "$servings"],
          },
        },
        sugarG: {
          $sum: {
            $multiply: [{ $ifNull: ["$snapshot.macrosPerServing.sugarG", 0] }, "$servings"],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ];
}

/** Per-day exercise calories burned. */
export function dailyExercisePipeline(userId: string, from: Date, to: Date): PipelineStage[] {
  return [
    dateRangeMatch(userId, from, to),
    { $group: { _id: "$date", caloriesBurned: { $sum: "$caloriesBurned" } } },
    { $sort: { _id: 1 } },
  ];
}

/** Per-day water totals (sum of all `amountMl` rows on that calendar day). */
export function dailyWaterPipeline(userId: string, from: Date, to: Date): PipelineStage[] {
  return [
    dateRangeMatch(userId, from, to),
    { $group: { _id: "$date", amountMl: { $sum: "$amountMl" } } },
    { $sort: { _id: 1 } },
  ];
}

/**
 * Per-day sleep aggregation. A user *can* log multiple naps for one wake date
 * (PRD §4.6 doesn't forbid it), so we sum the night's total minutes and average
 * the quality score. In the common case of one entry per night this collapses
 * to "the row" — the average of one number is itself.
 */
export function dailySleepPipeline(userId: string, from: Date, to: Date): PipelineStage[] {
  return [
    dateRangeMatch(userId, from, to),
    {
      $group: {
        _id: "$date",
        durationMinutes: { $sum: "$durationMinutes" },
        quality: { $avg: "$quality" },
      },
    },
    { $sort: { _id: 1 } },
  ];
}

/**
 * Per-day weight pulled from `BodyMeasurementEntry`, ignoring entries without
 * a logged weight (Phase 6 lets the user log only some metrics on a given day —
 * see DELIVERY_PLAN.md Phase 6 DoD line about per-metric independence).
 *
 * Tiebreaker for two same-day entries: take the latest by `createdAt` so an
 * after-the-fact correction wins over the earlier reading.
 */
export function dailyWeightPipeline(userId: string, from: Date, to: Date): PipelineStage[] {
  return [
    {
      $match: {
        userId: userOid(userId),
        date: { $gte: from, $lte: to },
        weightKg: { $ne: null },
      },
    },
    { $sort: { date: 1, createdAt: 1 } },
    { $group: { _id: "$date", weightKg: { $last: "$weightKg" } } },
    { $sort: { _id: 1 } },
  ];
}

/* ────────────────────────────── runners ────────────────────────────── */

export interface DailyFoodRow {
  date: Date;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
}

export interface DailyExerciseRow {
  date: Date;
  caloriesBurned: number;
}

export interface DailyWaterRow {
  date: Date;
  amountMl: number;
}

export interface DailySleepRow {
  date: Date;
  durationMinutes: number;
  quality: number;
}

export interface DailyWeightRow {
  date: Date;
  weightKg: number;
}

interface RawAggDoc {
  _id: Date;
  [k: string]: unknown;
}

function unwrapDate<T extends Record<string, unknown>>(rows: RawAggDoc[]): (T & { date: Date })[] {
  return rows.map(({ _id, ...rest }) => ({ ...(rest as T), date: _id }));
}

export async function runDailyFood(userId: string, from: Date, to: Date): Promise<DailyFoodRow[]> {
  const rows = (await FoodLogEntry.aggregate(dailyFoodPipeline(userId, from, to))) as RawAggDoc[];
  return unwrapDate<Omit<DailyFoodRow, "date">>(rows);
}

export async function runDailyExercise(
  userId: string,
  from: Date,
  to: Date,
): Promise<DailyExerciseRow[]> {
  const rows = (await ExerciseEntry.aggregate(
    dailyExercisePipeline(userId, from, to),
  )) as RawAggDoc[];
  return unwrapDate<Omit<DailyExerciseRow, "date">>(rows);
}

export async function runDailyWater(
  userId: string,
  from: Date,
  to: Date,
): Promise<DailyWaterRow[]> {
  const rows = (await WaterLogEntry.aggregate(
    dailyWaterPipeline(userId, from, to),
  )) as RawAggDoc[];
  return unwrapDate<Omit<DailyWaterRow, "date">>(rows);
}

export async function runDailySleep(
  userId: string,
  from: Date,
  to: Date,
): Promise<DailySleepRow[]> {
  const rows = (await SleepEntry.aggregate(
    dailySleepPipeline(userId, from, to),
  )) as RawAggDoc[];
  return unwrapDate<Omit<DailySleepRow, "date">>(rows);
}

export async function runDailyWeight(
  userId: string,
  from: Date,
  to: Date,
): Promise<DailyWeightRow[]> {
  const rows = (await BodyMeasurementEntry.aggregate(
    dailyWeightPipeline(userId, from, to),
  )) as RawAggDoc[];
  return unwrapDate<Omit<DailyWeightRow, "date">>(rows);
}

/** Most recent body measurement with a non-null `weightKg`, or null when none. */
export async function findLatestWeight(
  userId: string,
  asOf: Date,
): Promise<{ date: Date; weightKg: number } | null> {
  const doc = await BodyMeasurementEntry.findOne({
    userId: userOid(userId),
    date: { $lte: asOf },
    weightKg: { $ne: null },
  })
    .sort({ date: -1, createdAt: -1 })
    .lean<{ date: Date; weightKg: number } | null>();
  return doc ? { date: doc.date, weightKg: doc.weightKg } : null;
}

/** Most recent sleep entry whose wake date is ≤ `asOf`. */
export async function findLatestSleep(
  userId: string,
  asOf: Date,
): Promise<{ date: Date; durationMinutes: number; quality: number } | null> {
  const doc = await SleepEntry.findOne({
    userId: userOid(userId),
    date: { $lte: asOf },
  })
    .sort({ date: -1, wakeTime: -1 })
    .lean<{ date: Date; durationMinutes: number; quality: number } | null>();
  return doc
    ? { date: doc.date, durationMinutes: doc.durationMinutes, quality: doc.quality }
    : null;
}
