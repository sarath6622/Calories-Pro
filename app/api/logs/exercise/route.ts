import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { ExerciseEntry } from "@/lib/models/ExerciseEntry";
import { ExerciseCreateSchema } from "@/lib/validation/exercise-log";
import { apiError, zodError } from "@/lib/api/errors";
import { getSessionUser, ownerFilter } from "@/lib/api/session";
import { isIsoDate, startOfDayUTC } from "@/lib/log/date";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return apiError(401, "Unauthenticated");

  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date || !isIsoDate(date)) {
    return apiError(400, "Query parameter `date` must be YYYY-MM-DD");
  }

  await connectDb();
  const entries = await ExerciseEntry.find({
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

  const parsed = ExerciseCreateSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  await connectDb();
  const created = await ExerciseEntry.create({
    userId: new mongoose.Types.ObjectId(user.userId),
    date: startOfDayUTC(parsed.data.date),
    caloriesBurned: parsed.data.caloriesBurned,
    note: parsed.data.note ?? null,
    loggedAt: new Date(),
  });

  return NextResponse.json(created.toJSON(), { status: 201 });
}
