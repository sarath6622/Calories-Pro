"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricSamplePoint } from "@/lib/measurements/delta";

interface TrendChartProps {
  points: readonly MetricSamplePoint[];
  unit: string;
}

function formatDateTick(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TrendChart({ points, unit }: TrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={points as MetricSamplePoint[]} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={formatDateTick} minTickGap={32} />
        <YAxis domain={["auto", "auto"]} unit={unit ? ` ${unit}` : ""} width={70} />
        <Tooltip
          formatter={(v: number) => [`${v} ${unit}`, "Value"]}
          labelFormatter={(label: string) => new Date(label).toLocaleDateString()}
        />
        <Line type="monotone" dataKey="value" stroke="#1976d2" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
