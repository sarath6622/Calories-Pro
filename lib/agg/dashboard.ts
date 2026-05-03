/**
 * Dashboard payload builders. The Phase 7 API routes are thin wrappers around
 * these — they parse the query, call the right builder, and return the JSON.
 *
 * Splitting this file from the routes keeps the actual aggregation logic
 * type-checked end-to-end without any Next.js plumbing in the way, and lets
 * the e2e tests assert on the wire shape directly.
 */

import { connectDb } from "@/lib/db";
import { User } from "@/lib/models/User";
import {
  findLatestSleep,
  findLatestWeight,
  runDailyExercise,
  runDailyFood,
  runDailySleep,
  runDailyWater,
  runDailyWeight,
  type DailyExerciseRow,
  type DailyFoodRow,
  type DailySleepRow,
  type DailyWaterRow,
  type DailyWeightRow,
} from "./pipelines";
import {
  averageOf,
  daysWithinGoal,
  weightTrend,
  withinGoalRange,
  type WeightTrend,
} from "./totals";
import { endOfDayUTC, startOfDayUTC } from "@/lib/log/date";

export interface TodayPayload {
  date: string; // YYYY-MM-DD
  calories: {
    consumed: number;
    burned: number;
    net: number;
    goal: number;
    remaining: number;
    goalMet: boolean; // F-DSH-5
  };
  macros: {
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
    sugarG: number;
    proteinGoalG: number;
    carbsGoalG: number;
    fatGoalG: number;
  };
  water: {
    amountMl: number;
    goalMl: number;
  };
  sleep: {
    last: { date: string; durationMinutes: number; quality: number } | null;
    targetMinutes: number;
  };
  weight: {
    current: { date: string; weightKg: number } | null;
  };
}

export interface SummaryDay {
  date: string; // YYYY-MM-DD
  caloriesIn: number;
  caloriesOut: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterMl: number;
  sleepMinutes: number | null;
  weightKg: number | null;
}

export interface SummaryPayload {
  range: "week" | "month";
  from: string;
  to: string;
  days: SummaryDay[];
  totals: {
    averageDailyCalories: number | null;
    daysWithinGoal: number;
    totalExerciseCalories: number;
    averageSleepMinutes: number | null;
    averageWaterMl: number | null;
    averageSleepQuality: number | null;
    weightTrend: WeightTrend | null;
  };
  goals: {
    dailyCalories: number;
    dailyWaterMl: number;
    sleepMinutesTarget: number;
  };
}

interface UserGoals {
  dailyCalories: number;
  dailyProteinG: number;
  dailyCarbsG: number;
  dailyFatG: number;
  dailyWaterMl: number;
  sleepHoursTarget: number;
}

const DEFAULT_GOALS: UserGoals = Object.freeze({
  dailyCalories: 0,
  dailyProteinG: 0,
  dailyCarbsG: 0,
  dailyFatG: 0,
  dailyWaterMl: 0,
  sleepHoursTarget: 8,
});

async function loadGoals(userId: string): Promise<UserGoals> {
  const doc = await User.findById(userId).lean<{ goals?: Partial<UserGoals> }>();
  if (!doc?.goals) return DEFAULT_GOALS;
  return { ...DEFAULT_GOALS, ...doc.goals };
}

function isoDate(d: Date): string {
  // Always read the UTC components — `date` fields are stored at midnight UTC
  // (PRD §4.3) so the date portion is timezone-stable.
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysUTC(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/** F-DSH-1: build the full Today payload for a calendar date. */
export async function buildTodayPayload(
  userId: string,
  isoDay: string,
): Promise<TodayPayload> {
  await connectDb();
  const dayStart = startOfDayUTC(isoDay);
  const dayEnd = endOfDayUTC(isoDay);

  const [foodRows, exerciseRows, waterRows, goals, latestWeight, latestSleep] =
    await Promise.all([
      runDailyFood(userId, dayStart, dayEnd),
      runDailyExercise(userId, dayStart, dayEnd),
      runDailyWater(userId, dayStart, dayEnd),
      loadGoals(userId),
      findLatestWeight(userId, dayEnd),
      findLatestSleep(userId, dayEnd),
    ]);

  const food = foodRows[0];
  const exercise = exerciseRows[0];
  const water = waterRows[0];

  const consumed = round1(food?.calories ?? 0);
  const burned = round1(exercise?.caloriesBurned ?? 0);
  const net = round1(consumed - burned);
  const goal = goals.dailyCalories;
  const remaining = goal > 0 ? round1(goal - net) : 0;
  const goalMet = withinGoalRange(consumed, goal);

  return {
    date: isoDay,
    calories: { consumed, burned, net, goal, remaining, goalMet },
    macros: {
      proteinG: round1(food?.proteinG ?? 0),
      carbsG: round1(food?.carbsG ?? 0),
      fatG: round1(food?.fatG ?? 0),
      fiberG: round1(food?.fiberG ?? 0),
      sugarG: round1(food?.sugarG ?? 0),
      proteinGoalG: goals.dailyProteinG,
      carbsGoalG: goals.dailyCarbsG,
      fatGoalG: goals.dailyFatG,
    },
    water: {
      amountMl: water?.amountMl ?? 0,
      goalMl: goals.dailyWaterMl,
    },
    sleep: {
      last: latestSleep
        ? {
            date: latestSleep.date.toISOString(),
            durationMinutes: latestSleep.durationMinutes,
            quality: round1(latestSleep.quality),
          }
        : null,
      targetMinutes: Math.round(goals.sleepHoursTarget * 60),
    },
    weight: {
      current: latestWeight
        ? { date: latestWeight.date.toISOString(), weightKg: latestWeight.weightKg }
        : null,
    },
  };
}

/**
 * F-DSH-2 / F-DSH-3 weekly+monthly summary. `range` chooses the window length
 * (7 / 30 days, both **inclusive of `today`**, i.e. the last N calendar days).
 * Per-day rows are emitted for every day in the window so the chart on the
 * client doesn't have to fill missing dates itself.
 */
export async function buildSummaryPayload(
  userId: string,
  range: "week" | "month",
  isoToday: string,
): Promise<SummaryPayload> {
  await connectDb();
  const days = range === "week" ? 7 : 30;
  const toDayStart = startOfDayUTC(isoToday);
  const toDayEnd = endOfDayUTC(isoToday);
  const fromDayStart = addDaysUTC(toDayStart, -(days - 1));

  const [foodRows, exerciseRows, waterRows, sleepRows, weightRows, goals] = await Promise.all([
    runDailyFood(userId, fromDayStart, toDayEnd),
    runDailyExercise(userId, fromDayStart, toDayEnd),
    runDailyWater(userId, fromDayStart, toDayEnd),
    runDailySleep(userId, fromDayStart, toDayEnd),
    runDailyWeight(userId, fromDayStart, toDayEnd),
    loadGoals(userId),
  ]);

  const dayList = buildDailyRows(
    fromDayStart,
    days,
    foodRows,
    exerciseRows,
    waterRows,
    sleepRows,
    weightRows,
  );

  const dailyCalories = dayList.map((d) => d.caloriesIn);
  const sleepMinutes = dayList.map((d) => d.sleepMinutes);
  const sleepQualities = sleepRows.map((r) => r.quality);
  const waterPerDay = dayList.map((d) => d.waterMl);

  const totalExerciseCalories = round1(
    dayList.reduce((acc, d) => acc + d.caloriesOut, 0),
  );

  const sleepAvg = averageOf(sleepMinutes);

  return {
    range,
    from: isoDate(fromDayStart),
    to: isoToday,
    days: dayList,
    totals: {
      averageDailyCalories: averageOf(dailyCalories.filter((c) => c > 0)).average,
      daysWithinGoal: daysWithinGoal(dailyCalories, goals.dailyCalories),
      totalExerciseCalories,
      averageSleepMinutes: sleepAvg.average,
      averageWaterMl: averageOf(waterPerDay.filter((w) => w > 0)).average,
      averageSleepQuality: averageOf(sleepQualities).average,
      weightTrend: weightTrend(weightRows),
    },
    goals: {
      dailyCalories: goals.dailyCalories,
      dailyWaterMl: goals.dailyWaterMl,
      sleepMinutesTarget: Math.round(goals.sleepHoursTarget * 60),
    },
  };
}

function buildDailyRows(
  fromDayStart: Date,
  days: number,
  foodRows: DailyFoodRow[],
  exerciseRows: DailyExerciseRow[],
  waterRows: DailyWaterRow[],
  sleepRows: DailySleepRow[],
  weightRows: DailyWeightRow[],
): SummaryDay[] {
  const foodMap = byDate(foodRows);
  const exerciseMap = byDate(exerciseRows);
  const waterMap = byDate(waterRows);
  const sleepMap = byDate(sleepRows);
  const weightMap = byDate(weightRows);

  const out: SummaryDay[] = [];
  for (let i = 0; i < days; i += 1) {
    const day = addDaysUTC(fromDayStart, i);
    const key = isoDate(day);
    const f = foodMap.get(key);
    const e = exerciseMap.get(key);
    const w = waterMap.get(key);
    const s = sleepMap.get(key);
    const wt = weightMap.get(key);
    out.push({
      date: key,
      caloriesIn: round1(f?.calories ?? 0),
      caloriesOut: round1(e?.caloriesBurned ?? 0),
      proteinG: round1(f?.proteinG ?? 0),
      carbsG: round1(f?.carbsG ?? 0),
      fatG: round1(f?.fatG ?? 0),
      waterMl: w?.amountMl ?? 0,
      sleepMinutes: s?.durationMinutes ?? null,
      weightKg: wt?.weightKg ?? null,
    });
  }
  return out;
}

function byDate<T extends { date: Date }>(rows: readonly T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const r of rows) m.set(isoDate(r.date), r);
  return m;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
