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
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import {
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  MEAL_TYPE_ORDER,
  type MealType,
} from "@/lib/log/meal-type";
import { todayIsoDate } from "@/lib/log/date";
import { LogFoodDialog } from "./log-food-dialog";

interface SnapshotMacros {
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarG: number | null;
}

interface LogEntry {
  id: string;
  foodId: string;
  date: string;
  mealType: MealType;
  servings: number;
  snapshot: {
    name: string;
    caloriesPerServing: number;
    macrosPerServing: SnapshotMacros;
  };
  loggedAt: string;
}

interface DialogState {
  mode: "create" | "edit";
  mealType: MealType;
  entry?: LogEntry;
}

const ZERO_TOTALS = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };

function entryTotals(entry: LogEntry) {
  const m = entry.snapshot.macrosPerServing;
  return {
    calories: entry.snapshot.caloriesPerServing * entry.servings,
    proteinG: m.proteinG * entry.servings,
    carbsG: m.carbsG * entry.servings,
    fatG: m.fatG * entry.servings,
  };
}

function fmt(n: number, digits = 0): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function FoodLogView() {
  const [date, setDate] = useState<string>(todayIsoDate());
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const queryClient = useQueryClient();

  const queryKey = useMemo(() => ["log-food", date] as const, [date]);

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/logs/food?date=${encodeURIComponent(date)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load food log");
      const body = (await res.json()) as { entries: LogEntry[] };
      return body.entries;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/logs/food/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete entry");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["log-food"] });
    },
  });

  const groups = useMemo(() => {
    const map: Record<MealType, LogEntry[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };
    for (const e of listQuery.data ?? []) {
      map[e.mealType].push(e);
    }
    return map;
  }, [listQuery.data]);

  const totals = useMemo(() => {
    const sum = { ...ZERO_TOTALS };
    for (const e of listQuery.data ?? []) {
      const t = entryTotals(e);
      sum.calories += t.calories;
      sum.proteinG += t.proteinG;
      sum.carbsG += t.carbsG;
      sum.fatG += t.fatG;
    }
    return sum;
  }, [listQuery.data]);

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
            Daily totals
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={{ xs: 1, sm: 4 }}
            sx={{ mt: 1 }}
          >
            <Box>
              <Typography variant="h5">{fmt(totals.calories)} kcal</Typography>
              <Typography variant="caption" color="text.secondary">
                Calories
              </Typography>
            </Box>
            <Box>
              <Typography variant="h6">{fmt(totals.proteinG, 1)} g</Typography>
              <Typography variant="caption" color="text.secondary">
                Protein
              </Typography>
            </Box>
            <Box>
              <Typography variant="h6">{fmt(totals.carbsG, 1)} g</Typography>
              <Typography variant="caption" color="text.secondary">
                Carbs
              </Typography>
            </Box>
            <Box>
              <Typography variant="h6">{fmt(totals.fatG, 1)} g</Typography>
              <Typography variant="caption" color="text.secondary">
                Fat
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {listQuery.isError && (
        <Alert severity="error">Could not load entries. {String(listQuery.error)}</Alert>
      )}

      {listQuery.isLoading ? (
        <Stack spacing={1}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
          ))}
        </Stack>
      ) : (
        MEAL_TYPE_ORDER.map((meal) => (
          <MealSection
            key={meal}
            meal={meal}
            entries={groups[meal]}
            onAdd={() => setDialog({ mode: "create", mealType: meal })}
            onEdit={(entry) => setDialog({ mode: "edit", mealType: meal, entry })}
            onDelete={(entry) => deleteMutation.mutate(entry.id)}
            deletingId={deleteMutation.isPending ? deleteMutation.variables : undefined}
          />
        ))
      )}

      {dialog && (
        <LogFoodDialog
          open
          mode={dialog.mode}
          date={date}
          mealType={dialog.mealType}
          entry={
            dialog.entry
              ? {
                  id: dialog.entry.id,
                  servings: dialog.entry.servings,
                  snapshot: dialog.entry.snapshot,
                }
              : undefined
          }
          onClose={() => setDialog(null)}
        />
      )}
    </Stack>
  );
}

function MealSection({
  meal,
  entries,
  onAdd,
  onEdit,
  onDelete,
  deletingId,
}: {
  meal: MealType;
  entries: LogEntry[];
  onAdd: () => void;
  onEdit: (entry: LogEntry) => void;
  onDelete: (entry: LogEntry) => void;
  deletingId: string | undefined;
}) {
  const mealTotals = entries.reduce(
    (acc, e) => {
      const t = entryTotals(e);
      acc.calories += t.calories;
      return acc;
    },
    { calories: 0 },
  );

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {MEAL_TYPE_LABELS[meal]}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {entries.length === 0
                ? "Nothing logged"
                : `${entries.length} item${entries.length === 1 ? "" : "s"} · ${fmt(mealTotals.calories)} kcal`}
            </Typography>
          </Box>
          <Button startIcon={<AddIcon />} onClick={onAdd} aria-label={`Add to ${MEAL_TYPE_LABELS[meal]}`}>
            Add
          </Button>
        </Stack>
        {entries.length > 0 && (
          <Stack divider={<Divider flexItem />} spacing={1.25} sx={{ mt: 1 }}>
            {entries.map((entry) => {
              const t = entryTotals(entry);
              const m = entry.snapshot.macrosPerServing;
              return (
                <Stack
                  key={entry.id}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ sm: "center" }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2">
                      {entry.snapshot.name} · {fmt(entry.servings, 2)} ×
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {fmt(t.calories)} kcal · {fmt(m.proteinG * entry.servings, 1)}P /{" "}
                      {fmt(m.carbsG * entry.servings, 1)}C / {fmt(m.fatG * entry.servings, 1)}F
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.5} alignSelf={{ xs: "flex-end", sm: "center" }}>
                    <Tooltip title="Edit servings">
                      <IconButton
                        onClick={() => onEdit(entry)}
                        aria-label={`Edit servings for ${entry.snapshot.name}`}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete entry">
                      <IconButton
                        onClick={() => onDelete(entry)}
                        aria-label={`Delete ${entry.snapshot.name}`}
                        color="error"
                        disabled={deletingId === entry.id}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              );
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

// Re-export for tests if needed in the future
export const __testing = { entryTotals, MEAL_TYPES };
