import { describe, expect, it } from "vitest";
import { ExerciseCreateSchema, ExerciseUpdateSchema } from "@/lib/validation/exercise-log";

const valid = {
  date: "2026-05-03",
  caloriesBurned: 250,
  note: "30 min run",
};

describe("ExerciseCreateSchema", () => {
  it("accepts a valid payload", () => {
    expect(ExerciseCreateSchema.parse(valid)).toMatchObject(valid);
  });

  it("accepts a null note", () => {
    expect(ExerciseCreateSchema.parse({ ...valid, note: null }).note).toBeNull();
  });

  it("accepts an omitted note", () => {
    const out = ExerciseCreateSchema.parse({ date: valid.date, caloriesBurned: 100 });
    expect(out.note).toBeUndefined();
  });

  it("accepts zero calories (e.g., a non-energy session)", () => {
    expect(ExerciseCreateSchema.safeParse({ ...valid, caloriesBurned: 0 }).success).toBe(true);
  });

  it("rejects negative calories", () => {
    expect(ExerciseCreateSchema.safeParse({ ...valid, caloriesBurned: -1 }).success).toBe(false);
  });

  it("rejects malformed dates", () => {
    expect(ExerciseCreateSchema.safeParse({ ...valid, date: "2026/05/03" }).success).toBe(false);
    expect(ExerciseCreateSchema.safeParse({ ...valid, date: "2026-13-01" }).success).toBe(false);
  });

  it("rejects unknown extra keys (strict)", () => {
    expect(
      ExerciseCreateSchema.safeParse({ ...valid, extra: 1 } as never).success,
    ).toBe(false);
  });
});

describe("ExerciseUpdateSchema", () => {
  it("accepts a partial caloriesBurned-only update", () => {
    expect(ExerciseUpdateSchema.parse({ caloriesBurned: 500 })).toEqual({ caloriesBurned: 500 });
  });

  it("accepts a note-only update (incl. clearing to null)", () => {
    expect(ExerciseUpdateSchema.parse({ note: null })).toEqual({ note: null });
  });

  it("rejects an empty body", () => {
    expect(ExerciseUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("rejects unknown extras (strict) — date and userId must not be changeable", () => {
    expect(
      ExerciseUpdateSchema.safeParse({ caloriesBurned: 1, date: "2026-05-03" } as never).success,
    ).toBe(false);
    expect(
      ExerciseUpdateSchema.safeParse({ caloriesBurned: 1, userId: "x" } as never).success,
    ).toBe(false);
  });
});
