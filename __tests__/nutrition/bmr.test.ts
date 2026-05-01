import { describe, expect, it } from "vitest";
import { ageInYears, bmr } from "@/lib/nutrition/bmr";

describe("ageInYears", () => {
  it("computes whole years from a past DOB", () => {
    const now = new Date("2026-05-01T00:00:00Z");
    expect(ageInYears(new Date("1990-01-01"), now)).toBe(36);
    expect(ageInYears(new Date("1990-06-01"), now)).toBe(35);
  });

  it("returns 0 for future DOBs", () => {
    const now = new Date("2026-01-01");
    expect(ageInYears(new Date("2040-01-01"), now)).toBe(0);
  });
});

describe("BMR (Mifflin-St Jeor) — male", () => {
  // Male: 10w + 6.25h - 5a + 5
  const cases = [
    { weightKg: 70, heightCm: 175, ageYears: 30, expected: 10 * 70 + 6.25 * 175 - 5 * 30 + 5 },
    { weightKg: 80, heightCm: 180, ageYears: 25, expected: 10 * 80 + 6.25 * 180 - 5 * 25 + 5 },
    { weightKg: 60, heightCm: 165, ageYears: 40, expected: 10 * 60 + 6.25 * 165 - 5 * 40 + 5 },
    { weightKg: 95, heightCm: 190, ageYears: 50, expected: 10 * 95 + 6.25 * 190 - 5 * 50 + 5 },
    { weightKg: 55, heightCm: 160, ageYears: 18, expected: 10 * 55 + 6.25 * 160 - 5 * 18 + 5 },
    { weightKg: 110, heightCm: 200, ageYears: 35, expected: 10 * 110 + 6.25 * 200 - 5 * 35 + 5 },
  ];
  it.each(cases)(
    "%j",
    ({ weightKg, heightCm, ageYears, expected }) => {
      expect(bmr({ weightKg, heightCm, ageYears, sex: "male" })).toBeCloseTo(expected, 5);
    },
  );
});

describe("BMR (Mifflin-St Jeor) — female", () => {
  // Female: 10w + 6.25h - 5a - 161
  const cases = [
    { weightKg: 60, heightCm: 165, ageYears: 28, expected: 10 * 60 + 6.25 * 165 - 5 * 28 - 161 },
    { weightKg: 70, heightCm: 170, ageYears: 35, expected: 10 * 70 + 6.25 * 170 - 5 * 35 - 161 },
    { weightKg: 50, heightCm: 155, ageYears: 22, expected: 10 * 50 + 6.25 * 155 - 5 * 22 - 161 },
    { weightKg: 80, heightCm: 175, ageYears: 45, expected: 10 * 80 + 6.25 * 175 - 5 * 45 - 161 },
    { weightKg: 65, heightCm: 168, ageYears: 30, expected: 10 * 65 + 6.25 * 168 - 5 * 30 - 161 },
    { weightKg: 90, heightCm: 180, ageYears: 55, expected: 10 * 90 + 6.25 * 180 - 5 * 55 - 161 },
  ];
  it.each(cases)(
    "%j",
    ({ weightKg, heightCm, ageYears, expected }) => {
      expect(bmr({ weightKg, heightCm, ageYears, sex: "female" })).toBeCloseTo(expected, 5);
    },
  );
});

describe("BMR — edge cases", () => {
  it("returns null for sex=other (formula not defined)", () => {
    expect(bmr({ weightKg: 70, heightCm: 170, ageYears: 30, sex: "other" })).toBeNull();
  });

  it("returns null for non-positive weight or height", () => {
    expect(bmr({ weightKg: 0, heightCm: 170, ageYears: 30, sex: "male" })).toBeNull();
    expect(bmr({ weightKg: 70, heightCm: 0, ageYears: 30, sex: "male" })).toBeNull();
  });

  it("returns null for negative age", () => {
    expect(bmr({ weightKg: 70, heightCm: 170, ageYears: -1, sex: "male" })).toBeNull();
  });
});
