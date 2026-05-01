import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { User } from "@/lib/models/User";
import { PasswordResetToken } from "@/lib/models/PasswordResetToken";
import { generateResetToken, tokenExpiry } from "@/lib/auth/tokens";
import { buildPasswordResetEmail, sendMail } from "@/lib/auth/email";
import { ForgotPasswordSchema } from "@/lib/validation/auth";
import { apiError, zodError } from "@/lib/api/errors";

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const parsed = ForgotPasswordSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const { email } = parsed.data;

  await connectDb();
  const user = await User.findOne({ email }).lean();

  if (user) {
    const { token, tokenHash } = generateResetToken();
    await PasswordResetToken.create({
      userId: user._id,
      tokenHash,
      expiresAt: tokenExpiry(),
    });
    await sendMail({ to: email, ...buildPasswordResetEmail(token) });
  }

  return NextResponse.json({ ok: true });
}
