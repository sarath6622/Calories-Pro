import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export interface ApiErrorBody {
  error: string;
  details?: Record<string, unknown>;
}

export function apiError(
  status: number,
  message: string,
  details?: Record<string, unknown>,
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = { error: message };
  if (details) body.details = details;
  return NextResponse.json(body, { status });
}

export function zodError(err: ZodError): NextResponse<ApiErrorBody> {
  return apiError(400, "Validation failed", { issues: err.flatten() });
}
