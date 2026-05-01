import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { Food } from "@/lib/models/Food";
import { FoodUpdateSchema } from "@/lib/validation/food";
import { apiError, zodError } from "@/lib/api/errors";
import { canActOn, getSessionUser } from "@/lib/api/session";

interface RouteContext {
  params: { id: string };
}

function parseObjectId(id: string): mongoose.Types.ObjectId | null {
  return mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const user = await getSessionUser();
  if (!user) return apiError(401, "Unauthenticated");

  const oid = parseObjectId(params.id);
  if (!oid) return apiError(404, "Food not found");

  await connectDb();
  const food = await Food.findById(oid);
  if (!food) return apiError(404, "Food not found");
  if (!canActOn(user, food.userId.toString())) return apiError(403, "Forbidden");

  return NextResponse.json(food.toJSON());
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const user = await getSessionUser();
  if (!user) return apiError(401, "Unauthenticated");

  const oid = parseObjectId(params.id);
  if (!oid) return apiError(404, "Food not found");

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const parsed = FoodUpdateSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  await connectDb();
  const food = await Food.findById(oid);
  if (!food) return apiError(404, "Food not found");
  if (!canActOn(user, food.userId.toString())) return apiError(403, "Forbidden");

  food.set(parsed.data);
  await food.save();
  return NextResponse.json(food.toJSON());
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const user = await getSessionUser();
  if (!user) return apiError(401, "Unauthenticated");

  const oid = parseObjectId(params.id);
  if (!oid) return apiError(404, "Food not found");

  await connectDb();
  const food = await Food.findById(oid);
  if (!food) return apiError(404, "Food not found");
  if (!canActOn(user, food.userId.toString())) return apiError(403, "Forbidden");

  await food.deleteOne();
  return NextResponse.json({ ok: true });
}
