"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import type { SummaryPayload } from "@/lib/agg/dashboard";

// Recharts pulls a sizable runtime — only load it once we render this tab.
const SummaryCharts = dynamic(() => import("./summary-charts").then((m) => m.SummaryCharts), {
  ssr: false,
  loading: () => <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 2 }} />,
});

interface RangeViewProps {
  range: "week" | "month";
}

function formatMinutes(min: number | null): string {
  if (min === null) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatNumber(n: number | null, suffix = ""): string {
  if (n === null) return "—";
  return `${n}${suffix}`;
}

export function RangeView({ range }: RangeViewProps) {
  const summaryQuery = useQuery({
    queryKey: ["dashboard", "summary", range],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/summary?range=${range}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load summary");
      return (await res.json()) as SummaryPayload;
    },
    refetchOnMount: "always",
  });

  if (summaryQuery.isLoading) {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Grid key={i} item xs={12} sm={6} md={3}>
            <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
          </Grid>
        ))}
        <Grid item xs={12}>
          <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 2 }} />
        </Grid>
      </Grid>
    );
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return (
      <Alert severity="error">
        Could not load summary. {String(summaryQuery.error ?? "")}
      </Alert>
    );
  }

  const s = summaryQuery.data;
  const totalDays = s.days.length;
  const trend = s.totals.weightTrend;

  return (
    <Stack spacing={3} data-testid={`range-view-${range}`}>
      <Typography variant="caption" color="text.secondary" data-testid="range-window">
        {s.from} → {s.to} ({totalDays} days)
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={6} md={3}>
          <Card variant="outlined" sx={{ height: "100%" }} data-testid="stat-avg-calories">
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Avg daily calories
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {formatNumber(s.totals.averageDailyCalories, " kcal")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Across days with food logged
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card variant="outlined" sx={{ height: "100%" }} data-testid="stat-days-within-goal">
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Days within ±10% of goal
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {s.totals.daysWithinGoal} / {totalDays}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Goal {s.goals.dailyCalories || "—"} kcal/day
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card variant="outlined" sx={{ height: "100%" }} data-testid="stat-total-exercise">
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Total exercise
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {s.totals.totalExerciseCalories} kcal
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Sum of burned calories
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card variant="outlined" sx={{ height: "100%" }} data-testid="stat-avg-sleep">
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Avg sleep
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {formatMinutes(s.totals.averageSleepMinutes)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Quality {formatNumber(s.totals.averageSleepQuality)} / 5
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: "100%" }} data-testid="stat-weight-trend">
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Weight trend
              </Typography>
              {trend ? (
                <>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {trend.deltaKg > 0 ? "+" : ""}
                    {trend.deltaKg} kg
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    From {trend.start.weightKg} kg to {trend.end.weightKg} kg
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Need at least two weighed entries in this window.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: "100%" }} data-testid="stat-avg-water">
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Avg water (logged days)
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {formatNumber(s.totals.averageWaterMl, " ml")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Goal {s.goals.dailyWaterMl || "—"} ml/day
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box data-testid={`range-charts-${range}`}>
        <SummaryCharts payload={s} />
      </Box>
    </Stack>
  );
}
