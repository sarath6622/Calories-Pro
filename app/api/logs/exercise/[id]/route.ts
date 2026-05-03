import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { ExerciseEntry } from "@/lib/models/ExerciseEntry";
import { ExerciseUpdateSchema } from "@/lib/validation/exercise-log";
import { apiError, zodError } from "@/lib/api/errors";
import { canActOn, getSessionUser } from "@/lib/api/session";

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
  if (!oid) return apiError(404, "Exercise entry not found");

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const parsed = ExerciseUpdateSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  await connectDb();
  const entry = await ExerciseEntry.findById(oid);
  if (!entry) return apiError(404, "Exercise entry not found");
  if (!canActOn(user, entry.userId.toString())) return apiError(403, "Forbidden");

  if (parsed.data.caloriesBurned !== undefined) entry.caloriesBurned = parsed.data.caloriesBurned;
  if (parsed.data.note !== undefined) entry.note = parsed.data.note ?? null;
  await entry.save();
  return NextResponse.json(entry.toJSON());
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const user = await getSessionUser();
  if (!user) return apiError(401, "Unauthenticated");

  const oid = parseObjectId(params.id);
  if (!oid) return apiError(404, "Exercise entry not found");

  await connectDb();
  const entry = await ExerciseEntry.findById(oid);
  if (!entry) return apiError(404, "Exercise entry not found");
  if (!canActOn(user, entry.userId.toString())) return apiError(403, "Forbidden");

  await entry.deleteOne();
  return NextResponse.json({ ok: true });
}
