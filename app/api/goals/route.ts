import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { connectDb } from "@/lib/db";
import { User } from "@/lib/models/User";
import { GoalsUpdateSchema } from "@/lib/validation/goals";
import { apiError, zodError } from "@/lib/api/errors";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "Unauthenticated");

  await connectDb();
  const user = await User.findById(session.user.id);
  if (!user) return apiError(404, "User not found");

  return NextResponse.json({
    goals: user.goals,
    profile: {
      dateOfBirth: user.profile?.dateOfBirth ?? null,
      sex: user.profile?.sex ?? "other",
      heightCm: user.profile?.heightCm ?? null,
      weightKg: user.profile?.weightKg ?? null,
      activityLevel: user.profile?.activityLevel ?? "sedentary",
    },
  });
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

  const parsed = GoalsUpdateSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  await connectDb();
  const updated = await User.findByIdAndUpdate(
    session.user.id,
    { $set: { goals: parsed.data } },
    { new: true, runValidators: true },
  );
  if (!updated) return apiError(404, "User not found");

  return NextResponse.json({ goals: updated.goals });
}
