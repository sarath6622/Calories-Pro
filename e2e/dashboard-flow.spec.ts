import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

function uniqueEmail(label = "dash") {
  return `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

async function signupAndLogin(page: Page, email: string, password = "test1234abcd") {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Dashboard E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/profile$/, { timeout: 30_000 });
}

async function setGoals(request: APIRequestContext, dailyCalories: number, dailyWaterMl = 2000) {
  // 30/40/30 split is the F-GOAL-4 "balanced" preset; macros are derived for parity.
  const proteinG = Math.round((dailyCalories * 0.3) / 4);
  const carbsG = Math.round((dailyCalories * 0.4) / 4);
  const fatG = Math.round((dailyCalories * 0.3) / 9);
  const res = await request.patch("/api/goals", {
    data: {
      dailyCalories,
      dailyProteinG: proteinG,
      dailyCarbsG: carbsG,
      dailyFatG: fatG,
      dailyWaterMl,
      sleepHoursTarget: 8,
      macroPreset: "balanced",
      targetWeightKg: null,
    },
  });
  expect(res.status()).toBe(200);
}

async function createFood(
  request: APIRequestContext,
  cal: number,
  macros = { p: 10, c: 20, f: 5 },
): Promise<string> {
  const res = await request.post("/api/foods", {
    data: {
      name: `Food-${Date.now()}-${Math.random()}`,
      brand: null,
      servingSize: 100,
      servingUnit: "g",
      caloriesPerServing: cal,
      macrosPerServing: {
        proteinG: macros.p,
        carbsG: macros.c,
        fatG: macros.f,
        fiberG: null,
        sugarG: null,
      },
      isFavorite: false,
    },
  });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

test("dashboard Today view shows calories in/out/net + goal-met chip when within ±10%", async ({
  page,
}) => {
  await signupAndLogin(page, uniqueEmail());
  const ctx = page.context().request;

  // Goal 2000 kcal; we'll log exactly 2000 so the goalMet chip appears.
  await setGoals(ctx, 2000, 2000);

  const foodId = await createFood(ctx, 500, { p: 30, c: 60, f: 15 });
  const date = todayIso();

  // 4 servings × 500 = 2000 kcal exactly → within ±10% → goal met.
  const log1 = await ctx.post("/api/logs/food", {
    data: { foodId, date, mealType: "breakfast", servings: 4 },
  });
  expect(log1.status()).toBe(201);

  // 250 kcal exercise, 1500 ml water
  const ex = await ctx.post("/api/logs/exercise", {
    data: { date, caloriesBurned: 250, note: "run" },
  });
  expect(ex.status()).toBe(201);
  const w1 = await ctx.post("/api/logs/water", { data: { date, amountMl: 1000 } });
  expect(w1.status()).toBe(201);
  const w2 = await ctx.post("/api/logs/water", { data: { date, amountMl: 500 } });
  expect(w2.status()).toBe(201);

  // Last night's sleep: wake date = today, 7.5h = 450 min
  const bedtime = new Date(`${daysAgoIso(0)}T00:00:00Z`); // 00:00 UTC
  bedtime.setUTCDate(bedtime.getUTCDate() - 1); // yesterday
  bedtime.setUTCHours(23, 0, 0, 0); // yesterday 23:00
  const wake = new Date(bedtime);
  wake.setUTCHours(wake.getUTCHours() + 8); // +8h → today 07:00
  const sleep = await ctx.post("/api/logs/sleep", {
    data: {
      date,
      bedtime: bedtime.toISOString(),
      wakeTime: wake.toISOString(),
      quality: 4,
      note: null,
    },
  });
  expect(sleep.status()).toBe(201);

  // Current weight via measurement
  const m = await ctx.post("/api/measurements", {
    data: { date: daysAgoIso(1), weightKg: 70 },
  });
  expect(m.status()).toBe(201);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /^Dashboard$/ })).toBeVisible();

  // Today tab is the default. Wait for the calorie card to populate.
  await expect(page.getByTestId("calories-consumed")).toContainText("2000");
  await expect(page.getByTestId("calories-burned")).toContainText("250");
  // net = 2000 − 250 = 1750
  await expect(page.getByTestId("calories-net")).toContainText("1750");
  // remaining = goal − net = 2000 − 1750 = 250
  await expect(page.getByTestId("calories-remaining")).toContainText("250");
  // F-DSH-5: chip is present because 2000 is within ±10% of 2000.
  await expect(page.getByTestId("goal-met-chip")).toBeVisible();

  // Macros: 4 servings × {30P, 60C, 15F} = {120, 240, 60}
  await expect(page.getByTestId("macro-protein")).toContainText("120");
  await expect(page.getByTestId("macro-carbs")).toContainText("240");
  await expect(page.getByTestId("macro-fat")).toContainText("60");

  // Water: 1500 ml total
  await expect(page.getByTestId("water-amount")).toContainText("1500");

  // Sleep card: 8h last night
  await expect(page.getByTestId("sleep-duration")).toContainText(/8h/);

  // Weight card: 70 kg
  await expect(page.getByTestId("weight-value")).toContainText("70");
});

test("dashboard This week view aggregates 7 days and computes days-within-goal", async ({
  page,
}) => {
  await signupAndLogin(page, uniqueEmail("week"));
  const ctx = page.context().request;
  await setGoals(ctx, 2000);

  const foodId = await createFood(ctx, 1000); // 2 servings = 2000 kcal (in goal)
  const today = todayIso();

  // Day 0 (today), Day 2, Day 4: log 2000 kcal each → 3 days within goal.
  for (const offset of [0, 2, 4]) {
    const d = daysAgoIso(offset);
    const r = await ctx.post("/api/logs/food", {
      data: { foodId, date: d, mealType: "lunch", servings: 2 },
    });
    expect(r.status()).toBe(201);
  }
  // Day 1: log 1 serving (1000 kcal) — not within ±10%, doesn't count.
  const off = await ctx.post("/api/logs/food", {
    data: { foodId, date: daysAgoIso(1), mealType: "lunch", servings: 1 },
  });
  expect(off.status()).toBe(201);

  // Some exercise entries
  for (const offset of [0, 1, 3]) {
    await ctx.post("/api/logs/exercise", {
      data: { date: daysAgoIso(offset), caloriesBurned: 200, note: null },
    });
  }

  // Two weight entries to exercise the trend
  await ctx.post("/api/measurements", { data: { date: daysAgoIso(6), weightKg: 72 } });
  await ctx.post("/api/measurements", { data: { date: today, weightKg: 70 } });

  await page.goto("/dashboard");
  await page.getByTestId("tab-week").click();

  // Days-within-goal stat: 3 of 7
  await expect(page.getByTestId("stat-days-within-goal")).toContainText("3 / 7");
  // Total exercise: 600 kcal
  await expect(page.getByTestId("stat-total-exercise")).toContainText("600");
  // Weight trend: -2 kg over the window
  await expect(page.getByTestId("stat-weight-trend")).toContainText(/-2/);

  // The chart cards mount once Recharts loads.
  await expect(page.getByTestId("chart-calories")).toBeVisible();
  await expect(page.getByTestId("chart-macros")).toBeVisible();
  await expect(page.getByTestId("chart-weight")).toBeVisible();
});

test("dashboard API: cross-user isolation, anon 401, bad-input 400", async ({
  browser,
  request,
}) => {
  const aCtx = await browser.newContext();
  const aPage = await aCtx.newPage();
  await signupAndLogin(aPage, uniqueEmail("ownerA"));
  await setGoals(aCtx.request, 2000);

  // A logs 2000 kcal worth of food today.
  const foodId = await createFood(aCtx.request, 1000);
  const date = todayIso();
  await aCtx.request.post("/api/logs/food", {
    data: { foodId, date, mealType: "dinner", servings: 2 },
  });

  // B in a fresh context sees zero — never A's data.
  const bCtx = await browser.newContext();
  const bPage = await bCtx.newPage();
  await signupAndLogin(bPage, uniqueEmail("intruderB"));
  const bToday = (await bCtx.request
    .get("/api/dashboard/today")
    .then((r) => r.json())) as { calories: { consumed: number } };
  expect(bToday.calories.consumed).toBe(0);

  // anon → 401 on both endpoints
  expect((await request.get("/api/dashboard/today")).status()).toBe(401);
  expect((await request.get("/api/dashboard/summary?range=week")).status()).toBe(401);

  // 400 on missing or bad range
  expect((await aCtx.request.get("/api/dashboard/summary")).status()).toBe(400);
  expect((await aCtx.request.get("/api/dashboard/summary?range=year")).status()).toBe(400);
  expect((await aCtx.request.get("/api/dashboard/today?date=not-a-date")).status()).toBe(400);

  // A's own today payload is intact.
  const aTodayPayload = (await aCtx.request
    .get("/api/dashboard/today")
    .then((r) => r.json())) as { calories: { consumed: number; goalMet: boolean } };
  expect(aTodayPayload.calories.consumed).toBe(2000);
  expect(aTodayPayload.calories.goalMet).toBe(true);

  await aCtx.close();
  await bCtx.close();
});
