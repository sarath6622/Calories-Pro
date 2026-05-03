"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import { ALL_METRICS, METRIC_LABELS, METRIC_UNITS, type Metric } from "@/lib/models/measurement-enums";
import { summariseMetrics, type MeasurementEntryLike } from "@/lib/measurements/delta";

interface ListResponse {
  entries: MeasurementEntryLike[];
}

function formatValue(metric: Metric, n: number): string {
  // Weight and body-fat read more naturally with one decimal; circumferences
  // are usually whole-cm but allow a decimal anyway. Trim trailing zeroes so
  // "70.0" displays as "70".
  const rounded = Math.round(n * 10) / 10;
  return `${rounded} ${METRIC_UNITS[metric]}`;
}

function formatDelta(metric: Metric, delta: number): string {
  const abs = Math.abs(delta);
  const rounded = Math.round(abs * 10) / 10;
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±";
  return `${sign}${rounded} ${METRIC_UNITS[metric]}`;
}

function deltaColor(delta: number): "default" | "success" | "warning" {
  if (delta === 0) return "default";
  // Up vs down doesn't have a universally "good" direction (gaining weight
  // can be a goal), so colour by magnitude only — the sign is in the label.
  return Math.abs(delta) >= 0.1 ? "warning" : "default";
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function MeasurementsCardsView() {
  const listQuery = useQuery({
    queryKey: ["measurements", "all"],
    queryFn: async () => {
      const res = await fetch("/api/measurements", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load measurements");
      return (await res.json()) as ListResponse;
    },
  });

  const summaries = useMemo(
    () => summariseMetrics(listQuery.data?.entries ?? []),
    [listQuery.data],
  );

  const visibleMetrics = useMemo(
    () => ALL_METRICS.filter((m) => summaries[m] !== null),
    [summaries],
  );

  const totalEntries = listQuery.data?.entries.length ?? 0;

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ sm: "center" }}
      >
        <Typography variant="body2" color="text.secondary">
          {totalEntries === 0
            ? "No measurements logged yet."
            : `${totalEntries} ${totalEntries === 1 ? "entry" : "entries"} logged`}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button component={Link} href="/measurements/history" variant="outlined">
            History
          </Button>
          <Button component={Link} href="/measurements/new" variant="contained">
            Log measurements
          </Button>
        </Stack>
      </Stack>

      {listQuery.isError && (
        <Alert severity="error">Could not load measurements. {String(listQuery.error)}</Alert>
      )}

      {listQuery.isLoading ? (
        <Grid container spacing={2}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid key={i} item xs={12} sm={6} md={4}>
              <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      ) : visibleMetrics.length === 0 ? (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Once you log a measurement it will appear here as a card with the change since
              your last entry.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {visibleMetrics.map((metric) => {
            const summary = summaries[metric];
            if (!summary) return null;
            return (
              <Grid key={metric} item xs={12} sm={6} md={4}>
                <Card variant="outlined" sx={{ height: "100%" }} data-testid={`metric-card-${metric}`}>
                  <CardContent>
                    <Typography variant="overline" color="text.secondary">
                      {METRIC_LABELS[metric]}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      {formatValue(metric, summary.latest.value)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatRelativeDate(summary.latest.date)}
                    </Typography>
                    <Box sx={{ mt: 1.5 }}>
                      {summary.delta === null ? (
                        <Chip
                          size="small"
                          label="First entry"
                          variant="outlined"
                          data-testid={`metric-delta-${metric}`}
                        />
                      ) : (
                        <Chip
                          size="small"
                          label={`${formatDelta(metric, summary.delta)} since ${formatRelativeDate(
                            summary.previous?.date ?? summary.latest.date,
                          )}`}
                          color={deltaColor(summary.delta)}
                          variant="outlined"
                          data-testid={`metric-delta-${metric}`}
                        />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Stack>
  );
}
