import { describe, expect, it } from "vitest";
import { FoodCreateSchema, FoodUpdateSchema } from "@/lib/validation/food";

const valid = {
  name: "Boiled egg",
  brand: null,
  servingSize: 50,
  servingUnit: "g" as const,
  caloriesPerServing: 78,
  macrosPerServing: {
    proteinG: 6.3,
    carbsG: 0.6,
    fatG: 5.3,
    fiberG: 0,
    sugarG: 0.6,
  },
  isFavorite: false,
};

describe("FoodCreateSchema", () => {
  it("accepts a valid payload", () => {
    expect(FoodCreateSchema.parse(valid)).toEqual(valid);
  });

  it("requires a name", () => {
    expect(FoodCreateSchema.safeParse({ ...valid, name: "  " }).success).toBe(false);
  });

  it("rejects unknown serving units", () => {
    expect(
      FoodCreateSchema.safeParse({ ...valid, servingUnit: "scoop" as never }).success,
    ).toBe(false);
  });

  it("requires a positive serving size", () => {
    expect(FoodCreateSchema.safeParse({ ...valid, servingSize: 0 }).success).toBe(false);
    expect(FoodCreateSchema.safeParse({ ...valid, servingSize: -10 }).success).toBe(false);
  });

  it("rejects negative calories or macros", () => {
    expect(FoodCreateSchema.safeParse({ ...valid, caloriesPerServing: -1 }).success).toBe(false);
    expect(
      FoodCreateSchema.safeParse({
        ...valid,
        macrosPerServing: { ...valid.macrosPerServing, proteinG: -2 },
      }).success,
    ).toBe(false);
  });

  it("allows null fiber and sugar (PRD §4.2)", () => {
    const parsed = FoodCreateSchema.parse({
      ...valid,
      macrosPerServing: { ...valid.macrosPerServing, fiberG: null, sugarG: null },
    });
    expect(parsed.macrosPerServing.fiberG).toBeNull();
    expect(parsed.macrosPerServing.sugarG).toBeNull();
  });

  it("rejects unknown extra keys (strict)", () => {
    expect(
      FoodCreateSchema.safeParse({ ...valid, sneakyExtra: "no" } as never).success,
    ).toBe(false);
  });
});

describe("FoodUpdateSchema", () => {
  it("accepts an empty update", () => {
    expect(FoodUpdateSchema.parse({})).toEqual({});
  });

  it("accepts a partial update (just isFavorite)", () => {
    expect(FoodUpdateSchema.parse({ isFavorite: true })).toEqual({ isFavorite: true });
  });

  it("still rejects invalid fields when present", () => {
    expect(FoodUpdateSchema.safeParse({ servingUnit: "gallon" as never }).success).toBe(false);
  });

  it("strict mode rejects unknown keys on update", () => {
    expect(FoodUpdateSchema.safeParse({ rogue: 1 } as never).success).toBe(false);
  });
});
