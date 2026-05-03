import { describe, expect, it } from "vitest";
import { MEAL_TYPES, defaultMealType } from "@/lib/log/meal-type";

function at(hours: number, minutes = 0): Date {
  const d = new Date(2026, 0, 1, hours, minutes, 0, 0);
  return d;
}

describe("defaultMealType (F-LOG-2)", () => {
  it("declares the four meal types", () => {
    expect(MEAL_TYPES).toEqual(["breakfast", "lunch", "dinner", "snack"]);
  });

  const breakfast = [
    { hr: 4, min: 0 },
    { hr: 7, min: 30 },
    { hr: 10, min: 29 },
  ];
  const lunch = [
    { hr: 10, min: 30 },
    { hr: 12, min: 0 },
    { hr: 14, min: 59 },
  ];
  const snack = [
    { hr: 15, min: 0 },
    { hr: 16, min: 30 },
    { hr: 17, min: 59 },
  ];
  const dinner = [
    { hr: 18, min: 0 },
    { hr: 22, min: 0 },
    { hr: 0, min: 0 }, // midnight
    { hr: 3, min: 59 },
  ];

  it.each(breakfast)("$hr:$min -> breakfast", ({ hr, min }) => {
    expect(defaultMealType(at(hr, min))).toBe("breakfast");
  });
  it.each(lunch)("$hr:$min -> lunch", ({ hr, min }) => {
    expect(defaultMealType(at(hr, min))).toBe("lunch");
  });
  it.each(snack)("$hr:$min -> snack", ({ hr, min }) => {
    expect(defaultMealType(at(hr, min))).toBe("snack");
  });
  it.each(dinner)("$hr:$min -> dinner", ({ hr, min }) => {
    expect(defaultMealType(at(hr, min))).toBe("dinner");
  });
});
