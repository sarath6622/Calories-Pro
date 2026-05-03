/**
 * Phase 8 — POST /api/sync/replay
 *
 * Bulk-create entries that were queued client-side while offline (PRD §4.8 +
 * F-PWA-5). Each item carries a client-generated UUID (`id`); the per-model
 * sparse-unique index on (userId, clientId) makes this race-safe — a duplicate
 * insert raises Mongo E11000 which we catch and turn into a `duplicate` result.
 *
 * Request shape:
 *   { items: Array<{ id: string; type: QueueType; payload: object }> }
 *
 * Response shape (NFR-4 conformant):
 *   { results: Array<ReplayItemStatus> }
 *
 * The response is always 200 even when individual items fail — the orchestrator
 * needs per-id outcomes so it can dequeue the successful ones and retry the
 * transient failures. Top-level 4xx is reserved for "the whole batch is
 * malformed" (auth, body parse, schema, oversize).
 */
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { Food } from "@/lib/models/Food";
import { FoodLogEntry } from "@/lib/models/FoodLogEntry";
import { ExerciseEntry } from "@/lib/models/ExerciseEntry";
import { WaterLogEntry } from "@/lib/models/WaterLogEntry";
import { SleepEntry } from "@/lib/models/SleepEntry";
import { BodyMeasurementEntry } from "@/lib/models/BodyMeasurementEntry";
import { FoodLogCreateSchema } from "@/lib/validation/food-log";
import { ExerciseCreateSchema } from "@/lib/validation/exercise-log";
import { WaterCreateSchema } from "@/lib/validation/water-log";
import { SleepCreateSchema } from "@/lib/validation/sleep-log";
import { MeasurementCreateSchema } from "@/lib/validation/measurement";
import { apiError, zodError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/api/session";
import { startOfDayUTC } from "@/lib/log/date";
import { sleepDurationMinutes } from "@/lib/log/sleep";
import { buildFoodSnapshot } from "@/lib/log/snapshot";
import { QUEUE_TYPES, type ReplayItemStatus } from "@/lib/offline/types";

const MAX_ITEMS = 100;

const itemSchema = z
  .object({
    id: z.string().uuid(),
    type: z.enum(QUEUE_TYPES),
    payload: z.record(z.unknown()),
  })
  .strict();

const bodySchema = z
  .object({
    items: z.array(itemSchema).min(1).max(MAX_ITEMS),
  })
  .strict();

/**
 * Mongoose duplicate-key errors carry code 11000. Type-narrowed here so we
 * don't need an `any` cast at the catch site.
 */
function isDuplicateKey(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === 11000
  );
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return apiError(401, "Unauthenticated");

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  await connectDb();

  const userObjectId = new mongoose.Types.ObjectId(user.userId);
  const results: ReplayItemStatus[] = [];

  for (const item of parsed.data.items) {
    try {
      const result = await replayOne(item, userObjectId, user.userId, user.role);
      results.push(result);
    } catch (err) {
      // Defensive: anything not handled inside replayOne becomes a retryable
      // failure rather than crashing the whole batch.
      results.push({
        id: item.id,
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
        retryable: true,
      });
    }
  }

  return NextResponse.json({ results });
}

async function replayOne(
  item: z.infer<typeof itemSchema>,
  userObjectId: mongoose.Types.ObjectId,
  userIdString: string,
  role: string,
): Promise<ReplayItemStatus> {
  switch (item.type) {
    case "food_log":
      return replayFoodLog(item, userObjectId, userIdString, role);
    case "exercise":
      return replayExercise(item, userObjectId);
    case "water":
      return replayWater(item, userObjectId);
    case "sleep":
      return replaySleep(item, userObjectId);
    case "measurement":
      return replayMeasurement(item, userObjectId);
  }
}

async function replayFoodLog(
  item: z.infer<typeof itemSchema>,
  userObjectId: mongoose.Types.ObjectId,
  userIdString: string,
  role: string,
): Promise<ReplayItemStatus> {
  const v = FoodLogCreateSchema.safeParse(item.payload);
  if (!v.success) {
    return { id: item.id, status: "failed", error: "Validation failed", retryable: false };
  }
  const { foodId, date, mealType, servings } = v.data;

  const food = await Food.findById(foodId);
  if (!food) {
    return { id: item.id, status: "failed", error: "Food not found", retryable: false };
  }
  if (food.userId.toString() !== userIdString && role !== "admin") {
    return { id: item.id, status: "failed", error: "Forbidden", retryable: false };
  }

  const snapshot = buildFoodSnapshot({
    name: food.name,
    caloriesPerServing: food.caloriesPerServing,
    macrosPerServing: food.macrosPerServing,
  });

  const now = new Date();
  try {
    const created = await FoodLogEntry.create({
      userId: userObjectId,
      foodId: food._id,
      date: startOfDayUTC(date),
      mealType,
      servings,
      snapshot,
      loggedAt: now,
      syncedFromOffline: true,
      clientId: item.id,
    });
    // F-LOG-3: bump the food's "frequent" counters. Same semantics as the live
    // POST endpoint; an offline-first user shouldn't have their food fall out
    // of "Recent" just because they logged it without a network.
    await Food.updateOne(
      { _id: food._id },
      { $inc: { timesLogged: 1 }, $set: { lastLoggedAt: now } },
    );
    return { id: item.id, status: "created", serverId: created._id.toString() };
  } catch (err) {
    if (isDuplicateKey(err)) {
      const existing = await FoodLogEntry.findOne({
        userId: userObjectId,
        clientId: item.id,
      }).select("_id");
      if (existing) {
        return { id: item.id, status: "duplicate", serverId: existing._id.toString() };
      }
    }
    throw err;
  }
}

async function replayExercise(
  item: z.infer<typeof itemSchema>,
  userObjectId: mongoose.Types.ObjectId,
): Promise<ReplayItemStatus> {
  const v = ExerciseCreateSchema.safeParse(item.payload);
  if (!v.success) {
    return { id: item.id, status: "failed", error: "Validation failed", retryable: false };
  }
  try {
    const created = await ExerciseEntry.create({
      userId: userObjectId,
      date: startOfDayUTC(v.data.date),
      caloriesBurned: v.data.caloriesBurned,
      note: v.data.note ?? null,
      loggedAt: new Date(),
      syncedFromOffline: true,
      clientId: item.id,
    });
    return { id: item.id, status: "created", serverId: created._id.toString() };
  } catch (err) {
    if (isDuplicateKey(err)) {
      const existing = await ExerciseEntry.findOne({
        userId: userObjectId,
        clientId: item.id,
      }).select("_id");
      if (existing) {
        return { id: item.id, status: "duplicate", serverId: existing._id.toString() };
      }
    }
    throw err;
  }
}

async function replayWater(
  item: z.infer<typeof itemSchema>,
  userObjectId: mongoose.Types.ObjectId,
): Promise<ReplayItemStatus> {
  const v = WaterCreateSchema.safeParse(item.payload);
  if (!v.success) {
    return { id: item.id, status: "failed", error: "Validation failed", retryable: false };
  }
  try {
    const created = await WaterLogEntry.create({
      userId: userObjectId,
      date: startOfDayUTC(v.data.date),
      amountMl: v.data.amountMl,
      loggedAt: new Date(),
      syncedFromOffline: true,
      clientId: item.id,
    });
    return { id: item.id, status: "created", serverId: created._id.toString() };
  } catch (err) {
    if (isDuplicateKey(err)) {
      const existing = await WaterLogEntry.findOne({
        userId: userObjectId,
        clientId: item.id,
      }).select("_id");
      if (existing) {
        return { id: item.id, status: "duplicate", serverId: existing._id.toString() };
      }
    }
    throw err;
  }
}

async function replaySleep(
  item: z.infer<typeof itemSchema>,
  userObjectId: mongoose.Types.ObjectId,
): Promise<ReplayItemStatus> {
  const v = SleepCreateSchema.safeParse(item.payload);
  if (!v.success) {
    return { id: item.id, status: "failed", error: "Validation failed", retryable: false };
  }
  const bedtime = new Date(v.data.bedtime);
  const wakeTime = new Date(v.data.wakeTime);
  const durationMinutes = sleepDurationMinutes(bedtime, wakeTime);
  if (durationMinutes === null) {
    return {
      id: item.id,
      status: "failed",
      error: "wakeTime must be after bedtime",
      retryable: false,
    };
  }
  try {
    const created = await SleepEntry.create({
      userId: userObjectId,
      date: startOfDayUTC(v.data.date),
      bedtime,
      wakeTime,
      durationMinutes,
      quality: v.data.quality,
      note: v.data.note ?? null,
      syncedFromOffline: true,
      clientId: item.id,
    });
    return { id: item.id, status: "created", serverId: created._id.toString() };
  } catch (err) {
    if (isDuplicateKey(err)) {
      const existing = await SleepEntry.findOne({
        userId: userObjectId,
        clientId: item.id,
      }).select("_id");
      if (existing) {
        return { id: item.id, status: "duplicate", serverId: existing._id.toString() };
      }
    }
    throw err;
  }
}

async function replayMeasurement(
  item: z.infer<typeof itemSchema>,
  userObjectId: mongoose.Types.ObjectId,
): Promise<ReplayItemStatus> {
  const v = MeasurementCreateSchema.safeParse(item.payload);
  if (!v.success) {
    return { id: item.id, status: "failed", error: "Validation failed", retryable: false };
  }
  try {
    const created = await BodyMeasurementEntry.create({
      userId: userObjectId,
      date: startOfDayUTC(v.data.date),
      weightKg: v.data.weightKg ?? null,
      bodyFatPercent: v.data.bodyFatPercent ?? null,
      measurementsCm: v.data.measurementsCm ?? {},
      note: v.data.note ?? null,
      photos: [],
      syncedFromOffline: true,
      clientId: item.id,
    });
    return { id: item.id, status: "created", serverId: created._id.toString() };
  } catch (err) {
    if (isDuplicateKey(err)) {
      const existing = await BodyMeasurementEntry.findOne({
        userId: userObjectId,
        clientId: item.id,
      }).select("_id");
      if (existing) {
        return { id: item.id, status: "duplicate", serverId: existing._id.toString() };
      }
    }
    throw err;
  }
}
