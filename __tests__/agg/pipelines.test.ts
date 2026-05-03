/**
 * The pipeline builders are pure functions — they don't touch Mongo. Tests
 * lock the shape so a refactor that quietly drops the userId scoping or the
 * fiberG/sugarG null-coalesce will fail loudly.
 */
import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import {
  dailyExercisePipeline,
  dailyFoodPipeline,
  dailySleepPipeline,
  dailyWaterPipeline,
  dailyWeightPipeline,
} from "@/lib/agg/pipelines";

const USER_ID = new mongoose.Types.ObjectId().toString();
const FROM = new Date("2026-04-01T00:00:00Z");
const TO = new Date("2026-04-30T23:59:59.999Z");

describe("dailyFoodPipeline", () => {
  const p = dailyFoodPipeline(USER_ID, FROM, TO);

  it("starts with a userId+date $match (project rule #4)", () => {
    const match = p[0] as {
      $match: { userId: mongoose.Types.ObjectId; date: { $gte: Date; $lte: Date } };
    };
    expect(match.$match.userId).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(match.$match.userId.toString()).toBe(USER_ID);
    expect(match.$match.date.$gte).toEqual(FROM);
    expect(match.$match.date.$lte).toEqual(TO);
  });

  it("groups by date and multiplies snapshot fields by servings", () => {
    const group = p[1] as {
      $group: { _id: string; calories: { $sum: { $multiply: unknown[] } } };
    };
    expect(group.$group._id).toBe("$date");
    expect(group.$group.calories.$sum).toEqual({
      $multiply: ["$snapshot.caloriesPerServing", "$servings"],
    });
  });

  it("null-coalesces fiberG/sugarG to 0 (PRD §4.3 marks both nullable)", () => {
    const group = p[1] as {
      $group: {
        fiberG: { $sum: { $multiply: [{ $ifNull: [string, number] }, string] } };
        sugarG: { $sum: { $multiply: [{ $ifNull: [string, number] }, string] } };
      };
    };
    expect(group.$group.fiberG.$sum.$multiply[0]).toEqual({
      $ifNull: ["$snapshot.macrosPerServing.fiberG", 0],
    });
    expect(group.$group.sugarG.$sum.$multiply[0]).toEqual({
      $ifNull: ["$snapshot.macrosPerServing.sugarG", 0],
    });
  });

  it("ends with a chronological sort", () => {
    expect(p.at(-1)).toEqual({ $sort: { _id: 1 } });
  });
});

describe("dailyExercisePipeline", () => {
  it("sums caloriesBurned per day for the user's entries only", () => {
    const p = dailyExercisePipeline(USER_ID, FROM, TO);
    const match = p[0] as { $match: { userId: mongoose.Types.ObjectId } };
    expect(match.$match.userId.toString()).toBe(USER_ID);
    expect(p[1]).toEqual({
      $group: { _id: "$date", caloriesBurned: { $sum: "$caloriesBurned" } },
    });
  });
});

describe("dailyWaterPipeline", () => {
  it("sums amountMl per day", () => {
    const p = dailyWaterPipeline(USER_ID, FROM, TO);
    expect(p[1]).toEqual({
      $group: { _id: "$date", amountMl: { $sum: "$amountMl" } },
    });
  });
});

describe("dailySleepPipeline", () => {
  it("sums durationMinutes and averages quality (multi-nap safe)", () => {
    const p = dailySleepPipeline(USER_ID, FROM, TO);
    expect(p[1]).toEqual({
      $group: {
        _id: "$date",
        durationMinutes: { $sum: "$durationMinutes" },
        quality: { $avg: "$quality" },
      },
    });
  });
});

describe("dailyWeightPipeline", () => {
  it("filters out null weights and takes the latest createdAt per day", () => {
    const p = dailyWeightPipeline(USER_ID, FROM, TO);
    const match = p[0] as { $match: { weightKg: unknown } };
    expect(match.$match.weightKg).toEqual({ $ne: null });
    // The pre-group sort exists so $last picks the deterministic winner.
    expect(p[1]).toEqual({ $sort: { date: 1, createdAt: 1 } });
    expect(p[2]).toEqual({
      $group: { _id: "$date", weightKg: { $last: "$weightKg" } },
    });
  });
});
