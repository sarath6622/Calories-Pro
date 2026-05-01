import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { User } from "@/lib/models/User";
import { PasswordResetToken } from "@/lib/models/PasswordResetToken";
import { hashPassword } from "@/lib/auth/password";
import { hashToken, isExpired } from "@/lib/auth/tokens";
import { ResetPasswordSchema } from "@/lib/validation/auth";
import { apiError, zodError } from "@/lib/api/errors";

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const parsed = ResetPasswordSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const { token, password } = parsed.data;
  const tokenHash = hashToken(token);

  await connectDb();
  const record = await PasswordResetToken.findOne({ tokenHash });
  if (!record || record.usedAt || isExpired(record.expiresAt)) {
    return apiError(400, "Invalid or expired token");
  }

  const passwordHash = await hashPassword(password);
  await User.updateOne({ _id: record.userId }, { $set: { passwordHash } });
  record.usedAt = new Date();
  await record.save();

  return NextResponse.json({ ok: true });
}
