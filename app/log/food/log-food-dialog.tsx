"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Skeleton from "@mui/material/Skeleton";
import Box from "@mui/material/Box";
import { MEAL_TYPES, MEAL_TYPE_LABELS, type MealType } from "@/lib/log/meal-type";
import { tryOnlineOrEnqueue } from "@/lib/offline/use-offline-mutation";

interface FoodCandidate {
  id: string;
  name: string;
  brand: string | null;
  servingSize: number;
  servingUnit: string;
  caloriesPerServing: number;
}

interface DialogProps {
  open: boolean;
  mode: "create" | "edit";
  date: string;
  mealType: MealType;
  entry?: {
    id: string;
    servings: number;
    snapshot: {
      name: string;
      caloriesPerServing: number;
    };
  };
  onClose: () => void;
}

function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function LogFoodDialog({ open, mode, date, mealType, entry, onClose }: DialogProps) {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [selectedFood, setSelectedFood] = useState<FoodCandidate | null>(null);
  const [meal, setMeal] = useState<MealType>(mealType);
  const [servings, setServings] = useState<string>(entry ? String(entry.servings) : "1");
  const [serverError, setServerError] = useState<string | null>(null);

  // reset state when the dialog re-opens
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelectedFood(null);
    setMeal(mealType);
    setServings(entry ? String(entry.servings) : "1");
    setServerError(null);
  }, [open, mealType, entry]);

  const foodsQuery = useQuery({
    queryKey: ["foods", "all", debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      params.set("filter", "all");
      const res = await fetch(`/api/foods?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load foods");
      const body = (await res.json()) as { foods: FoodCandidate[] };
      return body.foods;
    },
    enabled: open && mode === "create",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFood) throw new Error("Pick a food first");
      const result = await tryOnlineOrEnqueue({
        type: "food_log",
        url: "/api/logs/food",
        payload: {
          foodId: selectedFood.id,
          date,
          mealType: meal,
          servings: Number(servings),
        },
      });
      if (result.outcome === "queued") return;
      const res = result.response!;
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not log food");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["log-food"] });
      onClose();
    },
    onError: (err) => setServerError(String(err.message ?? err)),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!entry) throw new Error("No entry to edit");
      const res = await fetch(`/api/logs/food/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servings: Number(servings) }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not update entry");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["log-food"] });
      onClose();
    },
    onError: (err) => setServerError(String(err.message ?? err)),
  });

  const submitting = createMutation.isPending || updateMutation.isPending;

  const previewKcal = useMemo(() => {
    const n = Number(servings);
    if (!Number.isFinite(n)) return null;
    if (mode === "create" && selectedFood) return n * selectedFood.caloriesPerServing;
    if (mode === "edit" && entry) return n * entry.snapshot.caloriesPerServing;
    return null;
  }, [servings, selectedFood, entry, mode]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const n = Number(servings);
    if (!Number.isFinite(n) || n <= 0) {
      setServerError("Servings must be a positive number");
      return;
    }
    if (mode === "create") {
      if (!selectedFood) {
        setServerError("Pick a food first");
        return;
      }
      createMutation.mutate();
    } else {
      updateMutation.mutate();
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {mode === "create" ? `Log to ${MEAL_TYPE_LABELS[meal]}` : "Edit servings"}
      </DialogTitle>
      <form onSubmit={handleSubmit} noValidate>
        <DialogContent>
          <Stack spacing={2}>
            {serverError && <Alert severity="error">{serverError}</Alert>}

            {mode === "create" ? (
              <>
                <TextField
                  label="Search foods"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  fullWidth
                  autoFocus
                />
                <Box sx={{ maxHeight: 220, overflowY: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                  {foodsQuery.isLoading ? (
                    <Stack spacing={0.5} sx={{ p: 1 }}>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} height={42} />
                      ))}
                    </Stack>
                  ) : foodsQuery.data && foodsQuery.data.length === 0 ? (
                    <Box sx={{ p: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        No foods. Add one in /foods.
                      </Typography>
                    </Box>
                  ) : (
                    <List dense disablePadding>
                      {foodsQuery.data?.map((food) => (
                        <ListItemButton
                          key={food.id}
                          selected={selectedFood?.id === food.id}
                          onClick={() => setSelectedFood(food)}
                        >
                          <ListItemText
                            primary={`${food.name}${food.brand ? ` · ${food.brand}` : ""}`}
                            secondary={`${food.caloriesPerServing} kcal per ${food.servingSize} ${food.servingUnit}`}
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  )}
                </Box>
              </>
            ) : (
              entry && (
                <Typography variant="body2" color="text.secondary">
                  Editing <strong>{entry.snapshot.name}</strong> ·{" "}
                  {entry.snapshot.caloriesPerServing} kcal per serving (snapshot)
                </Typography>
              )
            )}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                select
                label="Meal type"
                value={meal}
                onChange={(e) => setMeal(e.target.value as MealType)}
                fullWidth
                disabled={mode === "edit"}
                helperText={
                  mode === "edit" ? "Meal type is fixed once logged." : "Defaults from current time."
                }
              >
                {MEAL_TYPES.map((m) => (
                  <MenuItem key={m} value={m}>
                    {MEAL_TYPE_LABELS[m]}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Servings"
                type="number"
                inputProps={{ min: 0.0001, step: 0.25 }}
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                fullWidth
              />
            </Stack>

            {previewKcal != null && (
              <Typography variant="caption" color="text.secondary">
                ≈ {previewKcal.toFixed(0)} kcal
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={
              submitting || (mode === "create" && !selectedFood) || Number(servings) <= 0
            }
          >
            {submitting
              ? "Saving…"
              : mode === "create"
                ? "Log food"
                : "Save"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
