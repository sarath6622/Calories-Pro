import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/api/session";
import { isIsoDate, todayIsoDate } from "@/lib/log/date";
import { buildSummaryPayload } from "@/lib/agg/dashboard";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return apiError(401, "Unauthenticated");

  const url = new URL(req.url);
  const range = url.searchParams.get("range");
  if (range !== "week" && range !== "month") {
    return apiError(400, "Query parameter `range` must be 'week' or 'month'");
  }
  const dateParam = url.searchParams.get("date");
  if (dateParam !== null && !isIsoDate(dateParam)) {
    return apiError(400, "Query parameter `date` must be YYYY-MM-DD");
  }
  const isoToday = dateParam ?? todayIsoDate();

  const payload = await buildSummaryPayload(user.userId, range, isoToday);
  return NextResponse.json(payload);
}
