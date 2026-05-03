import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { WaterLogEntry } from "@/lib/models/WaterLogEntry";
import { apiError } from "@/lib/api/errors";
import { canActOn, getSessionUser } from "@/lib/api/session";

interface RouteContext {
  params: { id: string };
}

function parseObjectId(id: string): mongoose.Types.ObjectId | null {
  return mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const user = await getSessionUser();
  if (!user) return apiError(401, "Unauthenticated");

  const oid = parseObjectId(params.id);
  if (!oid) return apiError(404, "Water entry not found");

  await connectDb();
  const entry = await WaterLogEntry.findById(oid);
  if (!entry) return apiError(404, "Water entry not found");
  if (!canActOn(user, entry.userId.toString())) return apiError(403, "Forbidden");

  await entry.deleteOne();
  return NextResponse.json({ ok: true });
}
