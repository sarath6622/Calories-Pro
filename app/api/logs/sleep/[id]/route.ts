import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { SleepEntry } from "@/lib/models/SleepEntry";
import { SleepUpdateSchema } from "@/lib/validation/sleep-log";
import { apiError, zodError } from "@/lib/api/errors";
import { canActOn, getSessionUser } from "@/lib/api/session";
import { sleepDurationMinutes } from "@/lib/log/sleep";

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
  if (!oid) return apiError(404, "Sleep entry not found");

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const parsed = SleepUpdateSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  await connectDb();
  const entry = await SleepEntry.findById(oid);
  if (!entry) return apiError(404, "Sleep entry not found");
  if (!canActOn(user, entry.userId.toString())) return apiError(403, "Forbidden");

  if (parsed.data.bedtime !== undefined) entry.bedtime = new Date(parsed.data.bedtime);
  if (parsed.data.wakeTime !== undefined) entry.wakeTime = new Date(parsed.data.wakeTime);
  if (parsed.data.quality !== undefined) entry.quality = parsed.data.quality;
  if (parsed.data.note !== undefined) entry.note = parsed.data.note ?? null;

  // Recompute duration if either timestamp changed.
  if (parsed.data.bedtime !== undefined || parsed.data.wakeTime !== undefined) {
    const next = sleepDurationMinutes(entry.bedtime, entry.wakeTime);
    if (next === null) {
      return apiError(400, "wakeTime must be after bedtime");
    }
    entry.durationMinutes = next;
  }

  await entry.save();
  return NextResponse.json(entry.toJSON());
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const user = await getSessionUser();
  if (!user) return apiError(401, "Unauthenticated");

  const oid = parseObjectId(params.id);
  if (!oid) return apiError(404, "Sleep entry not found");

  await connectDb();
  const entry = await SleepEntry.findById(oid);
  if (!entry) return apiError(404, "Sleep entry not found");
  if (!canActOn(user, entry.userId.toString())) return apiError(403, "Forbidden");

  await entry.deleteOne();
  return NextResponse.json({ ok: true });
}
