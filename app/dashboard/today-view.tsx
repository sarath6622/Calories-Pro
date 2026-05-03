"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import LinearProgress from "@mui/material/LinearProgress";
import Skeleton from "@mui/material/Skeleton";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Snackbar from "@mui/material/Snackbar";
import Link from "next/link";
import Button from "@mui/material/Button";
import type { TodayPayload } from "@/lib/agg/dashboard";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function pct(value: number, goal: number): number {
  if (!Number.isFinite(goal) || goal <= 0) return 0;
  return Math.min(100, Math.round((value / goal) * 100));
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function TodayView() {
  const todayQuery = useQuery({
    queryKey: ["dashboard", "today"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/today", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load today");
      return (await res.json()) as TodayPayload;
    },
    refetchOnMount: "always",
  });

  // F-DSH-5: pop a goal-achievement toast on the transition into "within ±10%".
  const [showGoalToast, setShowGoalToast] = useState(false);
  const lastGoalMet = useRef<boolean | null>(null);
  useEffect(() => {
    const met = todayQuery.data?.calories.goalMet ?? false;
    if (lastGoalMet.current === false && met) {
      setShowGoalToast(true);
    }
    if (lastGoalMet.current === null && met) {
      // First load that already shows goal-met: don't pop the toast (prevents
      // a stale notification on a page refresh hours after the user hit the
      // goal). The toast is for the *transition*, not the resting state.
      lastGoalMet.current = met;
      return;
    }
    lastGoalMet.current = met;
  }, [todayQuery.data?.calories.goalMet]);

  if (todayQuery.isLoading) {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Grid key={i} item xs={12} sm={6} md={3}>
            <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 2 }} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (todayQuery.isError || !todayQuery.data) {
    return <Alert severity="error">Could not load today&apos;s data. {String(todayQuery.error ?? "")}</Alert>;
  }

  const t = todayQuery.data;
  const caloriesPct = t.calories.goal > 0 ? pct(t.calories.consumed, t.calories.goal) : 0;
  const waterPct = t.water.goalMl > 0 ? pct(t.water.amountMl, t.water.goalMl) : 0;

  return (
    <Stack spacing={3}>
      <Typography variant="caption" color="text.secondary" data-testid="today-date">
        {formatDate(t.date)}
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined" sx={{ height: "100%" }} data-testid="card-calories">
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Calories in
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 600 }} data-testid="calories-consumed">
                {t.calories.consumed} kcal
              </Typography>
              {t.calories.goal > 0 ? (
                <>
                  <LinearProgress
                    variant="determinate"
                    value={caloriesPct}
                    sx={{ mt: 1, height: 8, borderRadius: 1 }}
                    aria-label={`${caloriesPct}% of daily calorie goal`}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Goal {t.calories.goal} kcal · {caloriesPct}%
                  </Typography>
                </>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  Set a calorie goal in <Link href="/settings">Settings</Link>.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined" sx={{ height: "100%" }} data-testid="card-burned">
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Calories out
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 600 }} data-testid="calories-burned">
                {t.calories.burned} kcal
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Exercise logged today
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined" sx={{ height: "100%" }} data-testid="card-net">
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Net calories
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 600 }} data-testid="calories-net">
                {t.calories.net} kcal
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Consumed − burned
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined" sx={{ height: "100%" }} data-testid="card-remaining">
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Remaining vs goal
              </Typography>
              <Typography
                variant="h5"
                sx={{ fontWeight: 600 }}
                data-testid="calories-remaining"
                color={t.calories.remaining < 0 ? "error.main" : "text.primary"}
              >
                {t.calories.goal > 0 ? `${t.calories.remaining} kcal` : "—"}
              </Typography>
              {t.calories.goalMet ? (
                <Chip
                  size="small"
                  color="success"
                  variant="outlined"
                  label="Within ±10% of goal"
                  data-testid="goal-met-chip"
                  sx={{ mt: 1 }}
                />
              ) : (
                <Typography variant="caption" color="text.secondary">
                  {t.calories.goal > 0 ? "Aim for ±10% of goal" : "Set a goal first"}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: "100%" }} data-testid="card-macros">
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Macros
              </Typography>
              <Stack spacing={1.5} sx={{ mt: 1 }}>
                <MacroRow
                  label="Protein"
                  value={t.macros.proteinG}
                  goal={t.macros.proteinGoalG}
                  testid="macro-protein"
                />
                <MacroRow
                  label="Carbs"
                  value={t.macros.carbsG}
                  goal={t.macros.carbsGoalG}
                  testid="macro-carbs"
                />
                <MacroRow
                  label="Fat"
                  value={t.macros.fatG}
                  goal={t.macros.fatGoalG}
                  testid="macro-fat"
                />
              </Stack>
              {(t.macros.fiberG > 0 || t.macros.sugarG > 0) && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                  Fiber {t.macros.fiberG} g · Sugar {t.macros.sugarG} g
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined" sx={{ height: "100%" }} data-testid="card-water">
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Water
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 600 }} data-testid="water-amount">
                {t.water.amountMl} ml
              </Typography>
              {t.water.goalMl > 0 ? (
                <>
                  <LinearProgress
                    variant="determinate"
                    value={waterPct}
                    sx={{ mt: 1, height: 8, borderRadius: 1 }}
                    aria-label={`${waterPct}% of daily water goal`}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Goal {t.water.goalMl} ml · {waterPct}%
                  </Typography>
                </>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  Set a water goal in Settings.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined" sx={{ height: "100%" }} data-testid="card-sleep">
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Last sleep
              </Typography>
              {t.sleep.last ? (
                <>
                  <Typography variant="h5" sx={{ fontWeight: 600 }} data-testid="sleep-duration">
                    {formatMinutes(t.sleep.last.durationMinutes)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Quality {t.sleep.last.quality} / 5 · target {Math.round(t.sleep.targetMinutes / 60)}h
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No sleep entries yet.{" "}
                  <Link href="/log/sleep">Log sleep →</Link>
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined" sx={{ height: "100%" }} data-testid="card-weight">
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Current weight
              </Typography>
              {t.weight.current ? (
                <>
                  <Typography variant="h5" sx={{ fontWeight: 600 }} data-testid="weight-value">
                    {t.weight.current.weightKg} kg
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Logged {new Date(t.weight.current.date).toLocaleDateString()}
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No weight logged.{" "}
                  <Link href="/measurements/new">Log measurement →</Link>
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Stack direction="row" spacing={1}>
        <Button component={Link} href="/log/food" variant="contained" size="small">
          Log food
        </Button>
        <Button component={Link} href="/log/exercise" variant="outlined" size="small">
          Log exercise
        </Button>
        <Button component={Link} href="/log/water" variant="outlined" size="small">
          Log water
        </Button>
      </Stack>

      <Snackbar
        open={showGoalToast}
        autoHideDuration={6000}
        onClose={() => setShowGoalToast(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setShowGoalToast(false)}
          severity="success"
          variant="filled"
          data-testid="goal-met-toast"
        >
          Daily calorie goal reached — within ±10%.
        </Alert>
      </Snackbar>
    </Stack>
  );
}

function MacroRow({
  label,
  value,
  goal,
  testid,
}: {
  label: string;
  value: number;
  goal: number;
  testid: string;
}) {
  const p = pct(value, goal);
  return (
    <Box data-testid={testid}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline">
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {value} g{goal > 0 ? ` / ${goal} g` : ""}
        </Typography>
      </Stack>
      {goal > 0 && (
        <LinearProgress
          variant="determinate"
          value={p}
          sx={{ mt: 0.5, height: 6, borderRadius: 1 }}
          aria-label={`${label} ${p}%`}
        />
      )}
    </Box>
  );
}
