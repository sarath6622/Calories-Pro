import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Food } from "@/lib/models/Food";
import { FOOD_FILTERS, type FoodFilter } from "@/lib/models/food-enums";
import { FoodCreateSchema } from "@/lib/validation/food";
import { apiError, zodError } from "@/lib/api/errors";
import { getSessionUser, ownerFilter } from "@/lib/api/session";

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseFilter(value: string | null): FoodFilter {
  return (FOOD_FILTERS as readonly string[]).includes(value ?? "")
    ? (value as FoodFilter)
    : "all";
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return apiError(401, "Unauthenticated");

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const filter = parseFilter(url.searchParams.get("filter"));

  const query: Record<string, unknown> = { ...ownerFilter(user) };
  if (q) query.name = { $regex: escapeRegex(q), $options: "i" };
  if (filter === "favorites") query.isFavorite = true;
  if (filter === "recent") query.lastLoggedAt = { $ne: null };

  await connectDb();
  const foods = await Food.find(query)
    .sort({ lastLoggedAt: -1, timesLogged: -1, name: 1 })
    .limit(200);

  return NextResponse.json({ foods: foods.map((f) => f.toJSON()) });
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

  const parsed = FoodCreateSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  await connectDb();
  const created = await Food.create({ ...parsed.data, userId: user.userId });
  return NextResponse.json(created.toJSON(), { status: 201 });
}
