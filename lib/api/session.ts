import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import type { Role } from "@/lib/models/user-enums";

export interface SessionUser {
  userId: string;
  role: Role;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return { userId: session.user.id, role: session.user.role };
}

/** PR rule #4: every user-data query is scoped by userId; admins are exempt. */
export function ownerFilter(user: SessionUser): Record<string, unknown> {
  return user.role === "admin" ? {} : { userId: user.userId };
}

/** Returns true if `user` may read/mutate a doc with `ownerId`. */
export function canActOn(user: SessionUser, ownerId: string): boolean {
  return user.role === "admin" || ownerId === user.userId;
}
