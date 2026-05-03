import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { BodyMeasurementEntry } from "@/lib/models/BodyMeasurementEntry";
import { MeasurementCreateSchema } from "@/lib/validation/measurement";
import { apiError, zodError } from "@/lib/api/errors";
import { getSessionUser, ownerFilter } from "@/lib/api/session";
import { isIsoDate, startOfDayUTC, endOfDayUTC } from "@/lib/log/date";

const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 1000;

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return apiError(401, "Unauthenticated");

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const limitParam = url.searchParams.get("limit");

  const filter: Record<string, unknown> = { ...ownerFilter(user) };
  const dateFilter: Record<string, Date> = {};
  if (from) {
    if (!isIsoDate(from)) return apiError(400, "Query parameter `from` must be YYYY-MM-DD");
    dateFilter.$gte = startOfDayUTC(from);
  }
  if (to) {
    if (!isIsoDate(to)) return apiError(400, "Query parameter `to` must be YYYY-MM-DD");
    dateFilter.$lte = endOfDayUTC(to);
  }
  if (Object.keys(dateFilter).length > 0) filter.date = dateFilter;

  let limit = DEFAULT_LIMIT;
  if (limitParam !== null) {
    const parsed = Number(limitParam);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return apiError(400, "Query parameter `limit` must be a positive integer");
    }
    limit = Math.min(parsed, MAX_LIMIT);
  }

  await connectDb();
  const entries = await BodyMeasurementEntry.find(filter)
    .sort({ date: -1, createdAt: -1 })
    .limit(limit);

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

  const parsed = MeasurementCreateSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  await connectDb();
  const created = await BodyMeasurementEntry.create({
    userId: new mongoose.Types.ObjectId(user.userId),
    date: startOfDayUTC(parsed.data.date),
    weightKg: parsed.data.weightKg ?? null,
    bodyFatPercent: parsed.data.bodyFatPercent ?? null,
    measurementsCm: parsed.data.measurementsCm ?? {},
    note: parsed.data.note ?? null,
    photos: [],
  });

  return NextResponse.json(created.toJSON(), { status: 201 });
}
