import { describe, expect, it } from "vitest";
import { FoodLogCreateSchema, FoodLogUpdateSchema } from "@/lib/validation/food-log";

const validId = "a".repeat(24);

const valid = {
  foodId: validId,
  date: "2026-05-01",
  mealType: "breakfast" as const,
  servings: 1.5,
};

describe("FoodLogCreateSchema", () => {
  it("accepts a valid payload", () => {
    expect(FoodLogCreateSchema.parse(valid)).toEqual(valid);
  });

  it("rejects malformed object ids", () => {
    expect(FoodLogCreateSchema.safeParse({ ...valid, foodId: "not-an-id" }).success).toBe(false);
    expect(FoodLogCreateSchema.safeParse({ ...valid, foodId: "a".repeat(23) }).success).toBe(false);
  });

  it("rejects malformed dates", () => {
    expect(FoodLogCreateSchema.safeParse({ ...valid, date: "2026/05/01" }).success).toBe(false);
    expect(FoodLogCreateSchema.safeParse({ ...valid, date: "2026-13-01" }).success).toBe(false);
  });

  it("rejects unknown meal types", () => {
    expect(FoodLogCreateSchema.safeParse({ ...valid, mealType: "elevenses" as never }).success).toBe(
      false,
    );
  });

  it("rejects non-positive servings", () => {
    expect(FoodLogCreateSchema.safeParse({ ...valid, servings: 0 }).success).toBe(false);
    expect(FoodLogCreateSchema.safeParse({ ...valid, servings: -1 }).success).toBe(false);
  });

  it("rejects unknown extra keys (strict)", () => {
    expect(FoodLogCreateSchema.safeParse({ ...valid, sneakyExtra: 1 } as never).success).toBe(false);
  });
});

describe("FoodLogUpdateSchema", () => {
  it("only accepts servings", () => {
    expect(FoodLogUpdateSchema.parse({ servings: 2 })).toEqual({ servings: 2 });
  });

  it("rejects empty body (servings is required for an update to make sense)", () => {
    expect(FoodLogUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("rejects extra keys including foodId / date / mealType (strict)", () => {
    expect(FoodLogUpdateSchema.safeParse({ servings: 2, foodId: "x" } as never).success).toBe(
      false,
    );
    expect(FoodLogUpdateSchema.safeParse({ servings: 2, mealType: "lunch" } as never).success).toBe(
      false,
    );
  });
});
