"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Grid from "@mui/material/Grid";
import { todayIsoDate } from "@/lib/log/date";
import { CM_METRICS, METRIC_LABELS, type CmMetric } from "@/lib/models/measurement-enums";
import { tryOnlineOrEnqueue } from "@/lib/offline/use-offline-mutation";

type CircumferenceState = Record<CmMetric, string>;

function emptyCircumferences(): CircumferenceState {
  return CM_METRICS.reduce((acc, m) => {
    acc[m] = "";
    return acc;
  }, {} as CircumferenceState);
}

/** "" → undefined; otherwise parsed positive number, or null on parse failure (caller turns into a form error). */
function parseOptionalNumber(raw: string): number | undefined | null {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function MeasurementsForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [date, setDate] = useState<string>(todayIsoDate());
  const [weightKg, setWeightKg] = useState<string>("");
  const [bodyFatPercent, setBodyFatPercent] = useState<string>("");
  const [circ, setCirc] = useState<CircumferenceState>(emptyCircumferences());
  const [note, setNote] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const weight = parseOptionalNumber(weightKg);
      if (weight === null) throw new Error("Weight must be a number");
      const bf = parseOptionalNumber(bodyFatPercent);
      if (bf === null) throw new Error("Body fat must be a number");

      const measurementsCm: Partial<Record<CmMetric, number>> = {};
      for (const m of CM_METRICS) {
        const raw = circ[m];
        const v = parseOptionalNumber(raw);
        if (v === null) throw new Error(`${METRIC_LABELS[m]} must be a number`);
        if (v !== undefined) measurementsCm[m] = v;
      }

      const hasAny =
        weight !== undefined ||
        bf !== undefined ||
        Object.keys(measurementsCm).length > 0;
      if (!hasAny) {
        throw new Error("Provide at least one measurement (weight, body fat, or a circumference)");
      }

      const payload: Record<string, unknown> = { date };
      if (weight !== undefined) payload.weightKg = weight;
      if (bf !== undefined) payload.bodyFatPercent = bf;
      if (Object.keys(measurementsCm).length > 0) payload.measurementsCm = measurementsCm;
      if (note.trim()) payload.note = note.trim();

      const result = await tryOnlineOrEnqueue({
        type: "measurement",
        url: "/api/measurements",
        payload,
      });
      if (result.outcome === "queued") return;
      const res = result.response!;
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to log measurement");
      }
    },
    onSuccess: () => {
      setSubmitError(null);
      queryClient.invalidateQueries({ queryKey: ["measurements"] });
      router.push("/measurements");
    },
    onError: (err: unknown) => {
      setSubmitError(err instanceof Error ? err.message : "Failed to log measurement");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    createMutation.mutate();
  }

  return (
    <Stack spacing={3} component="form" onSubmit={handleSubmit}>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <TextField
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value || todayIsoDate())}
              InputLabelProps={{ shrink: true }}
              required
              sx={{ maxWidth: 240 }}
            />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Weight (kg)"
                  type="number"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  inputProps={{ min: 0, step: "0.1", inputMode: "decimal" }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Body fat (%)"
                  type="number"
                  value={bodyFatPercent}
                  onChange={(e) => setBodyFatPercent(e.target.value)}
                  inputProps={{ min: 0, max: 100, step: "0.1", inputMode: "decimal" }}
                  fullWidth
                />
              </Grid>
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Circumferences (cm)
          </Typography>
          <Grid container spacing={2}>
            {CM_METRICS.map((m) => (
              <Grid key={m} item xs={12} sm={6} md={4}>
                <TextField
                  label={METRIC_LABELS[m]}
                  type="number"
                  value={circ[m]}
                  onChange={(e) => setCirc((s) => ({ ...s, [m]: e.target.value }))}
                  inputProps={{ min: 0, step: "0.1", inputMode: "decimal" }}
                  fullWidth
                />
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <TextField
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            inputProps={{ maxLength: 500 }}
            fullWidth
            multiline
            minRows={2}
          />
        </CardContent>
      </Card>

      {submitError && <Alert severity="error">{submitError}</Alert>}

      <Box>
        <Stack direction="row" spacing={1}>
          <Button type="submit" variant="contained" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Saving…" : "Save measurement"}
          </Button>
          <Button variant="text" onClick={() => router.push("/measurements")}>
            Cancel
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
}
