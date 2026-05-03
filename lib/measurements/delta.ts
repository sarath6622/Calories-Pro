/**
 * PRD §5.8 / Phase 6 DoD: each metric's card shows the **most recent value
 * and the delta vs the previous logged value**. Two subtleties make this
 * non-trivial:
 *
 * 1. Per F-BM-1 the user logs only the metrics they care about that day. If
 *    they weighed in on Monday and only measured chest on Tuesday, then
 *    weight's "latest" is Monday but chest's "latest" is Tuesday — each
 *    metric has its own per-metric history.
 * 2. "Previous" means the previous *non-null* value of THE SAME metric, not
 *    the second-most-recent entry overall. (Phase 6 DoD line: "Logging only
 *    weight one day and only chest the next does not break delta display.")
 *
 * So this helper takes the raw entry list (newest first or any order) and
 * produces, for each metric, the latest value, the previous value, and the
 * signed delta — independently per metric.
 */

import { ALL_METRICS, CM_METRICS, type CmMetric, type Metric } from "@/lib/models/measurement-enums";

export interface MeasurementEntryLike {
  id?: string;
  date: string | Date;
  weightKg?: number | null;
  bodyFatPercent?: number | null;
  measurementsCm?: Partial<Record<CmMetric, number | null | undefined>> | null;
}

export interface MetricSamplePoint {
  date: string;
  value: number;
}

export interface MetricSummary {
  metric: Metric;
  latest: MetricSamplePoint;
  previous: MetricSamplePoint | null;
  /** `latest.value − previous.value`, or `null` when there is no previous. */
  delta: number | null;
}

function toIsoDateString(d: string | Date): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

function readMetric(entry: MeasurementEntryLike, metric: Metric): number | null {
  if (metric === "weightKg" || metric === "bodyFatPercent") {
    const v = entry[metric];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }
  const v = entry.measurementsCm?.[metric];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * For each metric, returns `{latest, previous, delta}` or `null` if the user
 * has never logged that metric. Entries may be supplied in any order.
 */
export function summariseMetrics(
  entries: readonly MeasurementEntryLike[],
): Record<Metric, MetricSummary | null> {
  // Sort once, newest first, ms-comparable.
  const sorted = [...entries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const out = {} as Record<Metric, MetricSummary | null>;
  for (const metric of ALL_METRICS) {
    let latest: MetricSamplePoint | null = null;
    let previous: MetricSamplePoint | null = null;
    for (const entry of sorted) {
      const v = readMetric(entry, metric);
      if (v === null) continue;
      const point: MetricSamplePoint = { date: toIsoDateString(entry.date), value: v };
      if (latest === null) {
        latest = point;
      } else {
        previous = point;
        break;
      }
    }
    out[metric] = latest === null
      ? null
      : {
          metric,
          latest,
          previous,
          delta: previous === null ? null : round3(latest.value - previous.value),
        };
  }
  return out;
}

/** Per-metric trend series, oldest → newest, suitable for a Recharts <LineChart>. */
export function metricSeries(
  entries: readonly MeasurementEntryLike[],
  metric: Metric,
): MetricSamplePoint[] {
  const points: MetricSamplePoint[] = [];
  for (const entry of entries) {
    const v = readMetric(entry, metric);
    if (v === null) continue;
    points.push({ date: toIsoDateString(entry.date), value: v });
  }
  return points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/** Avoid floating-point fuzz in the displayed delta. */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export { ALL_METRICS, CM_METRICS };
export type { Metric };
