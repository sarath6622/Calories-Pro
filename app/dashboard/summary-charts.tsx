"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import type { SummaryPayload } from "@/lib/agg/dashboard";

interface SummaryChartsProps {
  payload: SummaryPayload;
}

function shortDate(iso: string): string {
  // YYYY-MM-DD → MM/DD; the chart x-axis only needs day-of-month context.
  const [, mm, dd] = iso.split("-");
  return `${mm}/${dd}`;
}

export function SummaryCharts({ payload }: SummaryChartsProps) {
  const data = payload.days.map((d) => ({
    label: shortDate(d.date),
    caloriesIn: d.caloriesIn,
    caloriesOut: d.caloriesOut,
    proteinG: d.proteinG,
    carbsG: d.carbsG,
    fatG: d.fatG,
    waterMl: d.waterMl,
    sleepHours: d.sleepMinutes === null ? null : Math.round((d.sleepMinutes / 60) * 10) / 10,
    weightKg: d.weightKg,
  }));

  const goal = payload.goals.dailyCalories;
  const sleepTargetHours = payload.goals.sleepMinutesTarget / 60;
  const waterGoal = payload.goals.dailyWaterMl;
  const hasWeight = data.some((d) => d.weightKg !== null);

  return (
    <Stack spacing={3}>
      <Card variant="outlined" data-testid="chart-calories">
        <CardContent>
          <Typography variant="overline" color="text.secondary">
            Calorie trend
          </Typography>
          <Box sx={{ width: "100%", height: 240, mt: 1 }}>
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                {goal > 0 && (
                  <ReferenceLine
                    y={goal}
                    stroke="#888"
                    strokeDasharray="4 4"
                    label={{ value: `Goal ${goal}`, position: "right", fontSize: 11 }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="caloriesIn"
                  name="Consumed"
                  stroke="#1976d2"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="caloriesOut"
                  name="Burned"
                  stroke="#d32f2f"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined" data-testid="chart-macros">
        <CardContent>
          <Typography variant="overline" color="text.secondary">
            Macros (g, stacked)
          </Typography>
          <Box sx={{ width: "100%", height: 240, mt: 1 }}>
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="proteinG" name="Protein" stackId="m" fill="#2e7d32" />
                <Bar dataKey="carbsG" name="Carbs" stackId="m" fill="#ed6c02" />
                <Bar dataKey="fatG" name="Fat" stackId="m" fill="#9c27b0" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined" data-testid="chart-water">
        <CardContent>
          <Typography variant="overline" color="text.secondary">
            Water (ml)
          </Typography>
          <Box sx={{ width: "100%", height: 200, mt: 1 }}>
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                {waterGoal > 0 && (
                  <ReferenceLine
                    y={waterGoal}
                    stroke="#888"
                    strokeDasharray="4 4"
                    label={{ value: `Goal ${waterGoal}`, position: "right", fontSize: 11 }}
                  />
                )}
                <Bar dataKey="waterMl" name="Water" fill="#0288d1" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined" data-testid="chart-sleep">
        <CardContent>
          <Typography variant="overline" color="text.secondary">
            Sleep duration (h)
          </Typography>
          <Box sx={{ width: "100%", height: 200, mt: 1 }}>
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                {sleepTargetHours > 0 && (
                  <ReferenceLine
                    y={sleepTargetHours}
                    stroke="#888"
                    strokeDasharray="4 4"
                    label={{ value: `${sleepTargetHours}h`, position: "right", fontSize: 11 }}
                  />
                )}
                <Bar dataKey="sleepHours" name="Sleep" fill="#7b1fa2" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined" data-testid="chart-weight">
        <CardContent>
          <Typography variant="overline" color="text.secondary">
            Weight (kg)
          </Typography>
          {hasWeight ? (
            <Box sx={{ width: "100%", height: 200, mt: 1 }}>
              <ResponsiveContainer>
                <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis domain={["dataMin - 1", "dataMax + 1"]} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="weightKg"
                    name="Weight"
                    stroke="#5d4037"
                    strokeWidth={2}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              No weight logged in this range.
            </Typography>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
