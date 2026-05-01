"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import MenuItem from "@mui/material/MenuItem";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { SERVING_UNITS, type ServingUnit } from "@/lib/models/food-enums";
import { FoodCreateSchema, type FoodCreateInput } from "@/lib/validation/food";

export type FoodFormValues = FoodCreateInput;

export interface FoodFormProps {
  mode: "create" | "edit";
  initialValues: FoodFormValues;
  foodId?: string;
}

export function FoodForm({ mode, initialValues, foodId }: FoodFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FoodFormValues>({
    resolver: zodResolver(FoodCreateSchema),
    defaultValues: initialValues,
  });

  async function onSubmit(values: FoodFormValues) {
    setServerError(null);
    const url = mode === "create" ? "/api/foods" : `/api/foods/${foodId}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setServerError(body?.error ?? "Could not save food");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["foods"] });
    router.push("/foods");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack spacing={2}>
        {serverError && <Alert severity="error">{serverError}</Alert>}

        <TextField
          label="Name"
          fullWidth
          {...register("name")}
          error={!!errors.name}
          helperText={errors.name?.message}
        />

        <Controller
          control={control}
          name="brand"
          render={({ field }) => (
            <TextField
              label="Brand (optional)"
              fullWidth
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
              error={!!errors.brand}
              helperText={errors.brand?.message}
            />
          )}
        />

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="Serving size"
            type="number"
            fullWidth
            inputProps={{ min: 0, step: 0.01 }}
            {...register("servingSize", { valueAsNumber: true })}
            error={!!errors.servingSize}
            helperText={errors.servingSize?.message}
          />
          <Controller
            control={control}
            name="servingUnit"
            render={({ field }) => (
              <TextField select label="Unit" fullWidth {...field}>
                {SERVING_UNITS.map((u: ServingUnit) => (
                  <MenuItem key={u} value={u}>
                    {u}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Stack>

        <TextField
          label="Calories per serving (kcal)"
          type="number"
          fullWidth
          inputProps={{ min: 0, step: 1 }}
          {...register("caloriesPerServing", { valueAsNumber: true })}
          error={!!errors.caloriesPerServing}
          helperText={errors.caloriesPerServing?.message}
        />

        <Divider sx={{ my: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Macros per serving
          </Typography>
        </Divider>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="Protein (g)"
            type="number"
            fullWidth
            inputProps={{ min: 0, step: 0.1 }}
            {...register("macrosPerServing.proteinG", { valueAsNumber: true })}
            error={!!errors.macrosPerServing?.proteinG}
            helperText={errors.macrosPerServing?.proteinG?.message}
          />
          <TextField
            label="Carbs (g)"
            type="number"
            fullWidth
            inputProps={{ min: 0, step: 0.1 }}
            {...register("macrosPerServing.carbsG", { valueAsNumber: true })}
            error={!!errors.macrosPerServing?.carbsG}
            helperText={errors.macrosPerServing?.carbsG?.message}
          />
          <TextField
            label="Fat (g)"
            type="number"
            fullWidth
            inputProps={{ min: 0, step: 0.1 }}
            {...register("macrosPerServing.fatG", { valueAsNumber: true })}
            error={!!errors.macrosPerServing?.fatG}
            helperText={errors.macrosPerServing?.fatG?.message}
          />
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Controller
            control={control}
            name="macrosPerServing.fiberG"
            render={({ field }) => (
              <TextField
                label="Fiber (g, optional)"
                type="number"
                fullWidth
                inputProps={{ min: 0, step: 0.1 }}
                value={field.value ?? ""}
                onChange={(e) =>
                  field.onChange(e.target.value === "" ? null : Number(e.target.value))
                }
                error={!!errors.macrosPerServing?.fiberG}
                helperText={errors.macrosPerServing?.fiberG?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="macrosPerServing.sugarG"
            render={({ field }) => (
              <TextField
                label="Sugar (g, optional)"
                type="number"
                fullWidth
                inputProps={{ min: 0, step: 0.1 }}
                value={field.value ?? ""}
                onChange={(e) =>
                  field.onChange(e.target.value === "" ? null : Number(e.target.value))
                }
                error={!!errors.macrosPerServing?.sugarG}
                helperText={errors.macrosPerServing?.sugarG?.message}
              />
            )}
          />
        </Stack>

        <Controller
          control={control}
          name="isFavorite"
          render={({ field }) => (
            <FormControlLabel
              control={
                <Switch checked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} />
              }
              label="Mark as favorite"
            />
          )}
        />

        <Stack direction="row" spacing={1} justifyContent="space-between" sx={{ pt: 1 }}>
          <Button type="button" onClick={() => router.push("/foods")}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || (mode === "edit" && !isDirty)}
          >
            {isSubmitting
              ? "Saving…"
              : mode === "create"
                ? "Add food"
                : "Save changes"}
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
