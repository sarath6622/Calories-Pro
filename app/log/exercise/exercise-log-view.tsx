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
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import { todayIsoDate } from "@/lib/log/date";

interface ExerciseEntry {
  id: string;
  date: string;
  caloriesBurned: number;
  note: string | null;
  loggedAt: string;
}

export function ExerciseLogView() {
  const [date, setDate] = useState<string>(todayIsoDate());
  const [calories, setCalories] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const queryKey = useMemo(() => ["log-exercise", date] as const, [date]);

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/logs/exercise?date=${encodeURIComponent(date)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load exercise log");
      const body = (await res.json()) as { entries: ExerciseEntry[] };
      return body.entries;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: { caloriesBurned: number; note: string | null }) => {
      const res = await fetch("/api/logs/exercise", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, ...input }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to log exercise");
      }
    },
    onSuccess: () => {
      setCalories("");
      setNote("");
      setSubmitError(null);
      queryClient.invalidateQueries({ queryKey: ["log-exercise"] });
    },
    onError: (err: unknown) => {
      setSubmitError(err instanceof Error ? err.message : "Failed to log exercise");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/logs/exercise/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete entry");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["log-exercise"] });
    },
  });

  const totalBurned = useMemo(
    () => (listQuery.data ?? []).reduce((sum, e) => sum + e.caloriesBurned, 0),
    [listQuery.data],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const parsed = Number(calories);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setSubmitError("Calories burned must be a non-negative number");
      return;
    }
    createMutation.mutate({
      caloriesBurned: parsed,
      note: note.trim() ? note.trim() : null,
    });
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
          <Typography variant="overline" color="text.secondary">
            Total burned
          </Typography>
          <Typography variant="h5">{totalBurned.toLocaleString()} kcal</Typography>
        </CardContent>
      </Card>

      <Card variant="outlined" component="form" onSubmit={handleSubmit}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Add exercise
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Calories burned"
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              inputProps={{ min: 0, step: 1, inputMode: "numeric" }}
              required
              fullWidth
            />
            <TextField
              label="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., 30 min run"
              inputProps={{ maxLength: 500 }}
              fullWidth
            />
            {submitError && <Alert severity="error">{submitError}</Alert>}
            <Box>
              <Button
                type="submit"
                variant="contained"
                disabled={createMutation.isPending || calories === ""}
              >
                {createMutation.isPending ? "Logging…" : "Log exercise"}
              </Button>
            </Box>
          </Stack>
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
                <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
              ))}
            </Stack>
          ) : (listQuery.data ?? []).length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nothing logged yet for this date.
            </Typography>
          ) : (
            <Stack divider={<Divider flexItem />} spacing={1.25}>
              {(listQuery.data ?? []).map((entry) => (
                <Stack
                  key={entry.id}
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ minWidth: 0 }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2">
                      {entry.caloriesBurned.toLocaleString()} kcal
                    </Typography>
                    {entry.note && (
                      <Typography variant="body2" color="text.secondary">
                        {entry.note}
                      </Typography>
                    )}
                  </Box>
                  <Tooltip title="Delete entry">
                    <IconButton
                      onClick={() => deleteMutation.mutate(entry.id)}
                      aria-label={`Delete exercise entry ${entry.caloriesBurned} kcal`}
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
