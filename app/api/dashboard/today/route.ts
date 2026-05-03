import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/api/session";
import { isIsoDate, todayIsoDate } from "@/lib/log/date";
import { buildTodayPayload } from "@/lib/agg/dashboard";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return apiError(401, "Unauthenticated");

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  if (dateParam !== null && !isIsoDate(dateParam)) {
    return apiError(400, "Query parameter `date` must be YYYY-MM-DD");
  }
  const isoDay = dateParam ?? todayIsoDate();

  const payload = await buildTodayPayload(user.userId, isoDay);
  return NextResponse.json(payload);
}
