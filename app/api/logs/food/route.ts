import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { Food } from "@/lib/models/Food";
import { FoodLogEntry } from "@/lib/models/FoodLogEntry";
import { FoodLogCreateSchema } from "@/lib/validation/food-log";
import { apiError, zodError } from "@/lib/api/errors";
import { getSessionUser, ownerFilter } from "@/lib/api/session";
import { isIsoDate, startOfDayUTC } from "@/lib/log/date";
import { buildFoodSnapshot } from "@/lib/log/snapshot";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return apiError(401, "Unauthenticated");

  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date || !isIsoDate(date)) {
    return apiError(400, "Query parameter `date` must be YYYY-MM-DD");
  }

  await connectDb();
  const entries = await FoodLogEntry.find({
    ...ownerFilter(user),
    date: startOfDayUTC(date),
  }).sort({ loggedAt: 1 });

  return NextResponse.json({ entries: entries.map((e) => e.toJSON()) });
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

  const parsed = FoodLogCreateSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const { foodId, date, mealType, servings } = parsed.data;

  await connectDb();
  const food = await Food.findById(foodId);
  if (!food) return apiError(404, "Food not found");
  if (food.userId.toString() !== user.userId && user.role !== "admin") {
    return apiError(403, "Forbidden");
  }

  const snapshot = buildFoodSnapshot({
    name: food.name,
    caloriesPerServing: food.caloriesPerServing,
    macrosPerServing: food.macrosPerServing,
  });

  const now = new Date();
  const created = await FoodLogEntry.create({
    userId: new mongoose.Types.ObjectId(user.userId),
    foodId: food._id,
    date: startOfDayUTC(date),
    mealType,
    servings,
    snapshot,
    loggedAt: now,
    syncedFromOffline: false,
  });

  // F-LOG-3: bump the food's frequent-first counters (use the wall-clock now,
  // not the log's `date`, so foods logged backdated still show "recent").
  await Food.updateOne(
    { _id: food._id },
    { $inc: { timesLogged: 1 }, $set: { lastLoggedAt: now } },
  );

  return NextResponse.json(created.toJSON(), { status: 201 });
}
