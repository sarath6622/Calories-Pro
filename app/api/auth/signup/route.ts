import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { User } from "@/lib/models/User";
import { hashPassword } from "@/lib/auth/password";
import { SignupSchema } from "@/lib/validation/auth";
import { apiError, zodError } from "@/lib/api/errors";

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const parsed = SignupSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const { name, email, password } = parsed.data;

  await connectDb();
  const existing = await User.findOne({ email }).lean();
  if (existing) {
    return apiError(409, "An account with that email already exists");
  }

  const passwordHash = await hashPassword(password);
  const created = await User.create({ name, email, passwordHash });

  return NextResponse.json(
    {
      id: created._id.toString(),
      email: created.email,
      name: created.name,
    },
    { status: 201 },
  );
}
