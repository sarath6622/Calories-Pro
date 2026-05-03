import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { SleepEntry } from "@/lib/models/SleepEntry";
import { SleepCreateSchema } from "@/lib/validation/sleep-log";
import { apiError, zodError } from "@/lib/api/errors";
import { getSessionUser, ownerFilter } from "@/lib/api/session";
import { isIsoDate, startOfDayUTC } from "@/lib/log/date";
import { sleepDurationMinutes } from "@/lib/log/sleep";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return apiError(401, "Unauthenticated");

  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date || !isIsoDate(date)) {
    return apiError(400, "Query parameter `date` must be YYYY-MM-DD");
  }

  await connectDb();
  const entries = await SleepEntry.find({
    ...ownerFilter(user),
    date: startOfDayUTC(date),
  }).sort({ wakeTime: 1 });

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

  const parsed = SleepCreateSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const bedtime = new Date(parsed.data.bedtime);
  const wakeTime = new Date(parsed.data.wakeTime);
  const durationMinutes = sleepDurationMinutes(bedtime, wakeTime);
  if (durationMinutes === null) {
    return apiError(400, "wakeTime must be after bedtime");
  }

  await connectDb();
  const created = await SleepEntry.create({
    userId: new mongoose.Types.ObjectId(user.userId),
    date: startOfDayUTC(parsed.data.date),
    bedtime,
    wakeTime,
    durationMinutes,
    quality: parsed.data.quality,
    note: parsed.data.note ?? null,
  });

  return NextResponse.json(created.toJSON(), { status: 201 });
}
