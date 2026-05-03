import { describe, expect, it } from "vitest";
import { buildFoodSnapshot } from "@/lib/log/snapshot";

const baseFood = {
  name: "Boiled egg",
  caloriesPerServing: 78,
  macrosPerServing: { proteinG: 6.3, carbsG: 0.6, fatG: 5.3, fiberG: 0, sugarG: 0.6 },
};

describe("buildFoodSnapshot (PRD §4.3 invariant)", () => {
  it("copies the nutrition fields", () => {
    expect(buildFoodSnapshot(baseFood)).toEqual({
      name: "Boiled egg",
      caloriesPerServing: 78,
      macrosPerServing: { proteinG: 6.3, carbsG: 0.6, fatG: 5.3, fiberG: 0, sugarG: 0.6 },
    });
  });

  it("normalises missing fiber / sugar to null", () => {
    const food = {
      name: "Plain rice",
      caloriesPerServing: 130,
      macrosPerServing: { proteinG: 2.7, carbsG: 28, fatG: 0.3, fiberG: null, sugarG: null },
    };
    expect(buildFoodSnapshot(food)).toEqual({
      name: "Plain rice",
      caloriesPerServing: 130,
      macrosPerServing: { proteinG: 2.7, carbsG: 28, fatG: 0.3, fiberG: null, sugarG: null },
    });
  });

  it("the snapshot is a deep copy: mutating the source after build does not change it", () => {
    const food = structuredClone(baseFood);
    const snapshot = buildFoodSnapshot(food);

    food.name = "Mutated egg";
    food.caloriesPerServing = 999;
    food.macrosPerServing.proteinG = 999;
    food.macrosPerServing.fiberG = 999;

    expect(snapshot.name).toBe("Boiled egg");
    expect(snapshot.caloriesPerServing).toBe(78);
    expect(snapshot.macrosPerServing.proteinG).toBe(6.3);
    expect(snapshot.macrosPerServing.fiberG).toBe(0);
  });

  it("the snapshot is deep-frozen-equivalent: mutating the snapshot does not affect rebuilds", () => {
    const food = structuredClone(baseFood);
    const a = buildFoodSnapshot(food);
    a.macrosPerServing.proteinG = 0;
    const b = buildFoodSnapshot(food);
    expect(b.macrosPerServing.proteinG).toBe(6.3);
  });
});
