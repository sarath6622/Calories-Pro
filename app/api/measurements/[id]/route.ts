import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { BodyMeasurementEntry } from "@/lib/models/BodyMeasurementEntry";
import { MeasurementUpdateSchema } from "@/lib/validation/measurement";
import { apiError, zodError } from "@/lib/api/errors";
import { canActOn, getSessionUser } from "@/lib/api/session";
import { startOfDayUTC } from "@/lib/log/date";
import { CM_METRICS } from "@/lib/models/measurement-enums";

interface RouteContext {
  params: { id: string };
}

function parseObjectId(id: string): mongoose.Types.ObjectId | null {
  return mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const user = await getSessionUser();
  if (!user) return apiError(401, "Unauthenticated");

  const oid = parseObjectId(params.id);
  if (!oid) return apiError(404, "Measurement entry not found");

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const parsed = MeasurementUpdateSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  await connectDb();
  const entry = await BodyMeasurementEntry.findById(oid);
  if (!entry) return apiError(404, "Measurement entry not found");
  if (!canActOn(user, entry.userId.toString())) return apiError(403, "Forbidden");

  if (parsed.data.date !== undefined) entry.date = startOfDayUTC(parsed.data.date);
  if (parsed.data.weightKg !== undefined) entry.weightKg = parsed.data.weightKg ?? null;
  if (parsed.data.bodyFatPercent !== undefined) {
    entry.bodyFatPercent = parsed.data.bodyFatPercent ?? null;
  }
  if (parsed.data.measurementsCm !== undefined) {
    // Merge: caller may PATCH a single circumference without nuking the others.
    const incoming = parsed.data.measurementsCm;
    for (const m of CM_METRICS) {
      if (m in incoming) entry.measurementsCm[m] = incoming[m] ?? null;
    }
    entry.markModified("measurementsCm");
  }
  if (parsed.data.note !== undefined) entry.note = parsed.data.note ?? null;

  await entry.save();
  return NextResponse.json(entry.toJSON());
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const user = await getSessionUser();
  if (!user) return apiError(401, "Unauthenticated");

  const oid = parseObjectId(params.id);
  if (!oid) return apiError(404, "Measurement entry not found");

  await connectDb();
  const entry = await BodyMeasurementEntry.findById(oid);
  if (!entry) return apiError(404, "Measurement entry not found");
  if (!canActOn(user, entry.userId.toString())) return apiError(403, "Forbidden");

  await entry.deleteOne();
  return NextResponse.json({ ok: true });
}
