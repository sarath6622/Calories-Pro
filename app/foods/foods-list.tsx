"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import Stack from "@mui/material/Stack";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { FOOD_FILTERS, type FoodFilter } from "@/lib/models/food-enums";

interface FoodListItem {
  id: string;
  name: string;
  brand: string | null;
  servingSize: number;
  servingUnit: string;
  caloriesPerServing: number;
  macrosPerServing: {
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number | null;
    sugarG: number | null;
  };
  isFavorite: boolean;
  timesLogged: number;
  lastLoggedAt: string | null;
}

const FILTER_LABELS: Record<FoodFilter, string> = {
  all: "All",
  favorites: "Favorites",
  recent: "Recent",
};

function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function FoodsList() {
  const [filter, setFilter] = useState<FoodFilter>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [pendingDelete, setPendingDelete] = useState<FoodListItem | null>(null);
  const queryClient = useQueryClient();

  const queryKey = useMemo<QueryKey>(
    () => ["foods", filter, debouncedSearch],
    [filter, debouncedSearch],
  );

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      params.set("filter", filter);
      const res = await fetch(`/api/foods?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load foods");
      const body = (await res.json()) as { foods: FoodListItem[] };
      return body.foods;
    },
  });

  const favoriteMutation = useMutation({
    mutationFn: async (input: { id: string; isFavorite: boolean }) => {
      const res = await fetch(`/api/foods/${input.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: input.isFavorite }),
      });
      if (!res.ok) throw new Error("Failed to update favorite");
      return (await res.json()) as FoodListItem;
    },
    onMutate: async ({ id, isFavorite }) => {
      await queryClient.cancelQueries({ queryKey: ["foods"] });
      const snapshots = queryClient.getQueriesData<FoodListItem[]>({ queryKey: ["foods"] });
      snapshots.forEach(([key, data]) => {
        if (!data) return;
        queryClient.setQueryData<FoodListItem[]>(
          key,
          data.map((f) => (f.id === id ? { ...f, isFavorite } : f)),
        );
      });
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["foods"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/foods/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete food");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foods"] });
      setPendingDelete(null);
    },
  });

  return (
    <Stack spacing={2}>
      <Tabs
        value={filter}
        onChange={(_e, value: FoodFilter) => setFilter(value)}
        aria-label="Food filter"
      >
        {FOOD_FILTERS.map((f) => (
          <Tab key={f} value={f} label={FILTER_LABELS[f]} />
        ))}
      </Tabs>

      <TextField
        placeholder="Search by name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        fullWidth
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
        inputProps={{ "aria-label": "Search foods" }}
      />

      {listQuery.isError && (
        <Alert severity="error">Could not load foods. {String(listQuery.error)}</Alert>
      )}

      {listQuery.isLoading ? (
        <Stack spacing={1}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={88} sx={{ borderRadius: 2 }} />
          ))}
        </Stack>
      ) : listQuery.data && listQuery.data.length === 0 ? (
        <EmptyState filter={filter} search={debouncedSearch} />
      ) : (
        <Stack spacing={1.5}>
          {listQuery.data?.map((food) => (
            <FoodRow
              key={food.id}
              food={food}
              onToggleFavorite={() =>
                favoriteMutation.mutate({ id: food.id, isFavorite: !food.isFavorite })
              }
              onRequestDelete={() => setPendingDelete(food)}
            />
          ))}
        </Stack>
      )}

      <Dialog open={pendingDelete !== null} onClose={() => setPendingDelete(null)}>
        <DialogTitle>Delete this food?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <strong>{pendingDelete?.name}</strong> will be removed from your database. Past log
            entries that reference it will keep their nutrition snapshot.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function FoodRow({
  food,
  onToggleFavorite,
  onRequestDelete,
}: {
  food: FoodListItem;
  onToggleFavorite: () => void;
  onRequestDelete: () => void;
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {food.name}
              </Typography>
              {food.brand && (
                <Typography variant="body2" color="text.secondary">
                  · {food.brand}
                </Typography>
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {food.caloriesPerServing} kcal per {food.servingSize} {food.servingUnit} ·{" "}
              {food.macrosPerServing.proteinG}P / {food.macrosPerServing.carbsG}C /{" "}
              {food.macrosPerServing.fatG}F
            </Typography>
            {food.lastLoggedAt && (
              <Typography variant="caption" color="text.secondary">
                Logged {food.timesLogged}× · last on{" "}
                {new Date(food.lastLoggedAt).toLocaleDateString()}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={0.5} alignSelf={{ xs: "flex-end", sm: "center" }}>
            <Tooltip title={food.isFavorite ? "Unfavorite" : "Mark as favorite"}>
              <IconButton
                onClick={onToggleFavorite}
                aria-label={food.isFavorite ? "Unfavorite" : "Mark as favorite"}
                aria-pressed={food.isFavorite}
                color={food.isFavorite ? "warning" : "default"}
              >
                {food.isFavorite ? <StarIcon /> : <StarBorderIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit">
              <IconButton
                component={Link}
                href={`/foods/${food.id}/edit`}
                aria-label={`Edit ${food.name}`}
              >
                <EditIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton
                onClick={onRequestDelete}
                aria-label={`Delete ${food.name}`}
                color="error"
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function EmptyState({ filter, search }: { filter: FoodFilter; search: string }) {
  if (search) {
    return (
      <Alert severity="info">No foods match &ldquo;{search}&rdquo;.</Alert>
    );
  }
  if (filter === "favorites") {
    return <Alert severity="info">No favorites yet — tap the star on any food.</Alert>;
  }
  if (filter === "recent") {
    return (
      <Alert severity="info">
        No recent foods. They&apos;ll appear here once you start logging meals.
      </Alert>
    );
  }
  return (
    <Alert severity="info">
      Your food database is empty.{" "}
      <Link href="/foods/new" style={{ textDecoration: "underline" }}>
        Add your first food
      </Link>
      .
    </Alert>
  );
}
