"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import LinearProgress from "@mui/material/LinearProgress";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import { todayIsoDate } from "@/lib/log/date";

interface WaterEntry {
  id: string;
  date: string;
  amountMl: number;
  loggedAt: string;
}

interface GoalsResponse {
  goals: { dailyWaterMl: number };
}

const QUICK_ADDS = [250, 500, 750] as const;

export function WaterLogView() {
  const [date, setDate] = useState<string>(todayIsoDate());
  const [custom, setCustom] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const queryKey = useMemo(() => ["log-water", date] as const, [date]);

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/logs/water?date=${encodeURIComponent(date)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load water log");
      const body = (await res.json()) as { entries: WaterEntry[] };
      return body.entries;
    },
  });

  const goalsQuery = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const res = await fetch("/api/goals", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load goals");
      return (await res.json()) as GoalsResponse;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (amountMl: number) => {
      const res = await fetch("/api/logs/water", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, amountMl }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to log water");
      }
    },
    onSuccess: () => {
      setCustom("");
      setSubmitError(null);
      queryClient.invalidateQueries({ queryKey: ["log-water"] });
    },
    onError: (err: unknown) => {
      setSubmitError(err instanceof Error ? err.message : "Failed to log water");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/logs/water/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete entry");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["log-water"] });
    },
  });

  const total = useMemo(
    () => (listQuery.data ?? []).reduce((sum, e) => sum + e.amountMl, 0),
    [listQuery.data],
  );
  const goal = goalsQuery.data?.goals.dailyWaterMl ?? 0;
  const progress = goal > 0 ? Math.min(100, Math.round((total / goal) * 100)) : 0;

  function logCustom() {
    setSubmitError(null);
    const parsed = Number(custom);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
      setSubmitError("Enter a positive whole number of millilitres");
      return;
    }
    createMutation.mutate(parsed);
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
        <TextField
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value || todayIsoDate())}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 200 }}
        />
        <Button
          variant="outlined"
          onClick={() => setDate(todayIsoDate())}
          disabled={date === todayIsoDate()}
        >
          Today
        </Button>
      </Stack>

      <Card variant="outlined">
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ sm: "center" }}
            spacing={1}
          >
            <Box>
              <Typography variant="overline" color="text.secondary">
                Today
              </Typography>
              <Typography variant="h5">
                {total.toLocaleString()} ml
                {goal > 0 && (
                  <Typography component="span" variant="body2" color="text.secondary">
                    {" "}
                    / {goal.toLocaleString()} ml
                  </Typography>
                )}
              </Typography>
            </Box>
            {goal > 0 && (
              <Typography variant="body2" color="text.secondary">
                {progress}% of daily goal
              </Typography>
            )}
          </Stack>
          {goal > 0 && (
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ mt: 2, height: 10, borderRadius: 5 }}
              aria-label="Water progress"
            />
          )}
          {goal === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Set a daily water goal in <strong>Settings</strong> to track progress.
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Quick add
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {QUICK_ADDS.map((ml) => (
              <Button
                key={ml}
                variant="contained"
                onClick={() => createMutation.mutate(ml)}
                disabled={createMutation.isPending}
              >
                +{ml} ml
              </Button>
            ))}
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
            <TextField
              label="Custom (ml)"
              type="number"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              inputProps={{ min: 1, step: 1, inputMode: "numeric" }}
              size="small"
              sx={{ minWidth: 160 }}
            />
            <Button
              variant="outlined"
              onClick={logCustom}
              disabled={createMutation.isPending || custom === ""}
            >
              Add custom
            </Button>
          </Stack>
          {submitError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {submitError}
            </Alert>
          )}
        </CardContent>
      </Card>

      {listQuery.isError && (
        <Alert severity="error">Could not load entries. {String(listQuery.error)}</Alert>
      )}

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Entries
          </Typography>
          {listQuery.isLoading ? (
            <Stack spacing={1}>
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} variant="rectangular" height={40} sx={{ borderRadius: 1 }} />
              ))}
            </Stack>
          ) : (listQuery.data ?? []).length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nothing logged yet for this date.
            </Typography>
          ) : (
            <Stack divider={<Divider flexItem />} spacing={1}>
              {(listQuery.data ?? []).map((entry) => (
                <Stack
                  key={entry.id}
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ minWidth: 0 }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2">{entry.amountMl.toLocaleString()} ml</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(entry.loggedAt).toLocaleTimeString()}
                    </Typography>
                  </Box>
                  <Tooltip title="Delete entry">
                    <IconButton
                      onClick={() => deleteMutation.mutate(entry.id)}
                      aria-label={`Delete water entry ${entry.amountMl} ml`}
                      color="error"
                      disabled={deleteMutation.isPending && deleteMutation.variables === entry.id}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
