import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { connectDb } from "@/lib/db";
import { User } from "@/lib/models/User";
import { ProfileUpdateSchema } from "@/lib/validation/profile";
import { apiError, zodError } from "@/lib/api/errors";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "Unauthenticated");

  await connectDb();
  const user = await User.findById(session.user.id);
  if (!user) return apiError(404, "User not found");

  return NextResponse.json(user.toJSON());
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "Unauthenticated");

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const parsed = ProfileUpdateSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const { name, dateOfBirth, sex, heightCm, activityLevel, timezone, units } = parsed.data;

  const set: Record<string, unknown> = { name };
  if (dateOfBirth !== undefined) {
    set["profile.dateOfBirth"] = dateOfBirth ? new Date(dateOfBirth) : null;
  }
  if (sex !== undefined) set["profile.sex"] = sex;
  if (heightCm !== undefined) set["profile.heightCm"] = heightCm;
  if (activityLevel !== undefined) set["profile.activityLevel"] = activityLevel;
  if (timezone !== undefined) set["profile.timezone"] = timezone;
  if (units !== undefined) set["profile.units"] = units;

  await connectDb();
  const updated = await User.findByIdAndUpdate(
    session.user.id,
    { $set: set },
    { new: true, runValidators: true },
  );
  if (!updated) return apiError(404, "User not found");

  return NextResponse.json(updated.toJSON());
}
