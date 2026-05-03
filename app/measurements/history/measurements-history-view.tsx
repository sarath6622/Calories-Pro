"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import {
  ALL_METRICS,
  METRIC_LABELS,
  METRIC_UNITS,
  type Metric,
} from "@/lib/models/measurement-enums";
import { metricSeries, type MeasurementEntryLike } from "@/lib/measurements/delta";

// Recharts pulls in a sizable runtime; only ship to the client.
const TrendChart = dynamic(() => import("./trend-chart").then((m) => m.TrendChart), {
  ssr: false,
  loading: () => <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 1 }} />,
});

interface ListResponse {
  entries: MeasurementEntryLike[];
}

const RANGES = [
  { id: "1w", label: "1W", days: 7 },
  { id: "1m", label: "1M", days: 30 },
  { id: "3m", label: "3M", days: 90 },
  { id: "1y", label: "1Y", days: 365 },
  { id: "all", label: "All", days: null },
] as const;
type RangeId = (typeof RANGES)[number]["id"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoFromDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function MeasurementsHistoryView() {
  const [metric, setMetric] = useState<Metric>("weightKg");
  const [rangeId, setRangeId] = useState<RangeId>("3m");

  const range = RANGES.find((r) => r.id === rangeId) ?? RANGES[2];

  const queryString = useMemo(() => {
    if (range.days === null) return "";
    return `?from=${encodeURIComponent(isoFromDaysAgo(range.days))}`;
  }, [range]);

  const listQuery = useQuery({
    queryKey: ["measurements", "history", rangeId],
    queryFn: async () => {
      const res = await fetch(`/api/measurements${queryString}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load measurements");
      return (await res.json()) as ListResponse;
    },
  });

  const series = useMemo(
    () => metricSeries(listQuery.data?.entries ?? [], metric),
    [listQuery.data, metric],
  );

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
        <Button component={Link} href="/measurements" variant="text">
          ← Back to cards
        </Button>
        <Button component={Link} href="/measurements/new" variant="outlined">
          Log measurements
        </Button>
      </Stack>

      <Card variant="outlined">
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ sm: "center" }}
            justifyContent="space-between"
          >
            <TextField
              select
              label="Metric"
              value={metric}
              onChange={(e) => setMetric(e.target.value as Metric)}
              sx={{ minWidth: 220 }}
              size="small"
            >
              {ALL_METRICS.map((m) => (
                <MenuItem key={m} value={m}>
                  {METRIC_LABELS[m]}
                </MenuItem>
              ))}
            </TextField>
            <ToggleButtonGroup
              size="small"
              value={rangeId}
              exclusive
              onChange={(_, v: RangeId | null) => v && setRangeId(v)}
              aria-label="Time range"
            >
              {RANGES.map((r) => (
                <ToggleButton key={r.id} value={r.id} aria-label={r.label}>
                  {r.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>
        </CardContent>
      </Card>

      {listQuery.isError && (
        <Alert severity="error">Could not load measurements. {String(listQuery.error)}</Alert>
      )}

      <Card variant="outlined">
        <CardContent>
          <Typography variant="overline" color="text.secondary">
            {METRIC_LABELS[metric]} ({METRIC_UNITS[metric]})
          </Typography>
          {listQuery.isLoading ? (
            <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 1, mt: 1 }} />
          ) : series.length === 0 ? (
            <Box sx={{ py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                No {METRIC_LABELS[metric].toLowerCase()} data in this range.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ mt: 1 }} data-testid={`history-chart-${metric}`}>
              <TrendChart points={series} unit={METRIC_UNITS[metric]} />
            </Box>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
