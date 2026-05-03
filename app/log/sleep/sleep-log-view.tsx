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
import Rating from "@mui/material/Rating";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import { todayIsoDate } from "@/lib/log/date";
import { sleepDurationMinutes } from "@/lib/log/sleep";

interface SleepEntry {
  id: string;
  date: string;
  bedtime: string;
  wakeTime: string;
  durationMinutes: number;
  quality: number;
  note: string | null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Build a datetime-local value (`YYYY-MM-DDTHH:mm`) from a Date. */
function toDateTimeLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function defaultBedtime(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(23, 0, 0, 0);
  return toDateTimeLocal(d);
}

function defaultWakeTime(): string {
  const d = new Date();
  d.setHours(7, 0, 0, 0);
  return toDateTimeLocal(d);
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function SleepLogView() {
  const [date, setDate] = useState<string>(todayIsoDate());
  const [bedtime, setBedtime] = useState<string>(defaultBedtime());
  const [wakeTime, setWakeTime] = useState<string>(defaultWakeTime());
  const [quality, setQuality] = useState<number | null>(4);
  const [note, setNote] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const queryKey = useMemo(() => ["log-sleep", date] as const, [date]);

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/logs/sleep?date=${encodeURIComponent(date)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load sleep log");
      const body = (await res.json()) as { entries: SleepEntry[] };
      return body.entries;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!quality) throw new Error("Pick a quality rating (1–5)");
      const bd = new Date(bedtime);
      const wd = new Date(wakeTime);
      const res = await fetch("/api/logs/sleep", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date,
          bedtime: bd.toISOString(),
          wakeTime: wd.toISOString(),
          quality,
          note: note.trim() ? note.trim() : null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to log sleep");
      }
    },
    onSuccess: () => {
      setNote("");
      setSubmitError(null);
      queryClient.invalidateQueries({ queryKey: ["log-sleep"] });
    },
    onError: (err: unknown) => {
      setSubmitError(err instanceof Error ? err.message : "Failed to log sleep");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/logs/sleep/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete entry");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["log-sleep"] });
    },
  });

  const previewDuration = useMemo(() => {
    const bd = new Date(bedtime);
    const wd = new Date(wakeTime);
    return sleepDurationMinutes(bd, wd);
  }, [bedtime, wakeTime]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (previewDuration === null) {
      setSubmitError("Wake time must be after bedtime");
      return;
    }
    if (!quality) {
      setSubmitError("Pick a quality rating (1–5)");
      return;
    }
    createMutation.mutate();
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
        <TextField
          label="Wake date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value || todayIsoDate())}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 200 }}
          helperText="The day you woke up"
        />
        <Button
          variant="outlined"
          onClick={() => setDate(todayIsoDate())}
          disabled={date === todayIsoDate()}
        >
          Today
        </Button>
      </Stack>

      <Card variant="outlined" component="form" onSubmit={handleSubmit}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Add sleep
          </Typography>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Bedtime"
                type="datetime-local"
                value={bedtime}
                onChange={(e) => setBedtime(e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
                fullWidth
              />
              <TextField
                label="Wake time"
                type="datetime-local"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
                fullWidth
              />
            </Stack>
            <Box>
              <Typography variant="overline" color="text.secondary">
                Duration
              </Typography>
              <Typography variant="h6" data-testid="sleep-duration-preview">
                {previewDuration === null ? "—" : formatDuration(previewDuration)}
              </Typography>
            </Box>
            <Box>
              <Typography component="legend" variant="body2" sx={{ mb: 0.5 }}>
                Quality
              </Typography>
              <Rating
                value={quality}
                onChange={(_, v) => setQuality(v)}
                max={5}
                aria-label="Sleep quality"
              />
            </Box>
            <TextField
              label="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              inputProps={{ maxLength: 500 }}
              fullWidth
              multiline
              minRows={2}
            />
            {submitError && <Alert severity="error">{submitError}</Alert>}
            <Box>
              <Button
                type="submit"
                variant="contained"
                disabled={createMutation.isPending || previewDuration === null || !quality}
              >
                {createMutation.isPending ? "Logging…" : "Log sleep"}
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
              <Skeleton variant="rectangular" height={64} sx={{ borderRadius: 1 }} />
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
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ sm: "center" }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2">
                      {formatDuration(entry.durationMinutes)} · {"★".repeat(entry.quality)}
                      {"☆".repeat(5 - entry.quality)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(entry.bedtime).toLocaleString()} →{" "}
                      {new Date(entry.wakeTime).toLocaleString()}
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
                      aria-label={`Delete sleep entry from ${new Date(entry.wakeTime).toLocaleDateString()}`}
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
