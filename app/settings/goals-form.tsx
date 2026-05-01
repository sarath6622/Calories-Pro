"use client";

import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Link from "next/link";
import type { ActivityLevel, Sex } from "@/lib/models/user-enums";
import { ageInYears, bmr } from "@/lib/nutrition/bmr";
import { tdee } from "@/lib/nutrition/tdee";
import {
  MACRO_PRESETS,
  MACRO_PRESET_SPLITS,
  macroGramsFromPreset,
  type MacroPreset,
} from "@/lib/nutrition/macros";
import { defaultWaterGoalMl } from "@/lib/nutrition/water";
import { GoalsUpdateSchema, type GoalsUpdateInput } from "@/lib/validation/goals";

export interface GoalsFormData {
  profile: {
    dateOfBirth: string | null;
    sex: Sex;
    heightCm: number | null;
    weightKg: number | null;
    activityLevel: ActivityLevel;
  };
  goals: GoalsUpdateInput;
}

const PRESET_LABELS: Record<MacroPreset, string> = {
  balanced: "Balanced (30 / 40 / 30)",
  high_protein: "High protein (40 / 30 / 30)",
  low_carb: "Low carb (35 / 25 / 40)",
  custom: "Custom grams",
};

export function GoalsForm({ initialData }: { initialData: GoalsFormData }) {
  const [status, setStatus] = useState<{ kind: "ok" | "err"; message: string } | null>(null);

  const { profile } = initialData;

  const computed = useMemo(() => {
    const age = profile.dateOfBirth ? ageInYears(new Date(profile.dateOfBirth)) : null;
    const bmrValue =
      age != null && profile.heightCm != null && profile.weightKg != null
        ? bmr({
            ageYears: age,
            heightCm: profile.heightCm,
            weightKg: profile.weightKg,
            sex: profile.sex,
          })
        : null;
    const tdeeValue = tdee(bmrValue, profile.activityLevel);
    return { age, bmrValue, tdeeValue };
  }, [profile]);

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<GoalsUpdateInput>({
    resolver: zodResolver(GoalsUpdateSchema),
    defaultValues: initialData.goals,
  });

  const dailyCalories = watch("dailyCalories");
  const macroPreset = watch("macroPreset");

  function applySuggestedTdee() {
    if (computed.tdeeValue == null) return;
    setValue("dailyCalories", computed.tdeeValue, { shouldDirty: true });
    if (macroPreset !== "custom") {
      const grams = macroGramsFromPreset(computed.tdeeValue, macroPreset);
      setValue("dailyProteinG", grams.proteinG, { shouldDirty: true });
      setValue("dailyCarbsG", grams.carbsG, { shouldDirty: true });
      setValue("dailyFatG", grams.fatG, { shouldDirty: true });
    }
  }

  function applyPreset(preset: MacroPreset) {
    setValue("macroPreset", preset, { shouldDirty: true });
    if (preset !== "custom" && dailyCalories > 0) {
      const grams = macroGramsFromPreset(dailyCalories, preset);
      setValue("dailyProteinG", grams.proteinG, { shouldDirty: true });
      setValue("dailyCarbsG", grams.carbsG, { shouldDirty: true });
      setValue("dailyFatG", grams.fatG, { shouldDirty: true });
    }
  }

  function applyDefaultWater() {
    const def = defaultWaterGoalMl(profile.weightKg);
    if (def != null) setValue("dailyWaterMl", def, { shouldDirty: true });
  }

  async function onSubmit(values: GoalsUpdateInput) {
    setStatus(null);
    const res = await fetch("/api/goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setStatus({ kind: "err", message: body?.error ?? "Could not save goals" });
      return;
    }
    setStatus({ kind: "ok", message: "Goals saved." });
    reset(values);
  }

  const missingForBmr =
    profile.dateOfBirth == null
      ? "date of birth"
      : profile.heightCm == null
        ? "height"
        : profile.weightKg == null
          ? "weight"
          : profile.sex === "other"
            ? null
            : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack spacing={3}>
        {status && (
          <Alert severity={status.kind === "ok" ? "success" : "error"}>{status.message}</Alert>
        )}

        <Card variant="outlined">
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              Suggested daily energy
            </Typography>
            {computed.tdeeValue != null && computed.bmrValue != null ? (
              <Stack spacing={1} sx={{ mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  BMR (Mifflin-St Jeor): {Math.round(computed.bmrValue)} kcal/day
                </Typography>
                <Typography variant="h5">TDEE: {computed.tdeeValue} kcal/day</Typography>
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  onClick={applySuggestedTdee}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Use {computed.tdeeValue} kcal as my goal
                </Button>
              </Stack>
            ) : profile.sex === "other" ? (
              <Alert severity="info" sx={{ mt: 1 }}>
                The Mifflin-St Jeor equation is defined only for male / female. Set your daily
                calorie goal manually below.
              </Alert>
            ) : missingForBmr ? (
              <Alert severity="info" sx={{ mt: 1 }}>
                Add your {missingForBmr} on the{" "}
                <Link href="/profile" style={{ textDecoration: "underline" }}>
                  profile page
                </Link>{" "}
                to see a suggested calorie target.
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Stack spacing={2}>
          <Typography variant="h6">Calorie target</Typography>
          <TextField
            label="Daily calories (kcal)"
            type="number"
            fullWidth
            inputProps={{ min: 0, step: 1 }}
            {...register("dailyCalories", { valueAsNumber: true })}
            error={!!errors.dailyCalories}
            helperText={errors.dailyCalories?.message}
          />
        </Stack>

        <Divider />

        <Stack spacing={2}>
          <Typography variant="h6">Macros</Typography>
          <Controller
            control={control}
            name="macroPreset"
            render={({ field }) => (
              <TextField
                select
                label="Macro split"
                fullWidth
                {...field}
                onChange={(e) => applyPreset(e.target.value as MacroPreset)}
              >
                {MACRO_PRESETS.map((p) => (
                  <MenuItem key={p} value={p}>
                    {PRESET_LABELS[p]}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          {macroPreset !== "custom" && dailyCalories > 0 && (
            <Typography variant="caption" color="text.secondary">
              {MACRO_PRESET_SPLITS[macroPreset].proteinPct}% protein /{" "}
              {MACRO_PRESET_SPLITS[macroPreset].carbsPct}% carbs /{" "}
              {MACRO_PRESET_SPLITS[macroPreset].fatPct}% fat at {dailyCalories} kcal.
            </Typography>
          )}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Protein (g)"
              type="number"
              fullWidth
              inputProps={{ min: 0, step: 1 }}
              disabled={macroPreset !== "custom"}
              {...register("dailyProteinG", { valueAsNumber: true })}
              error={!!errors.dailyProteinG}
              helperText={errors.dailyProteinG?.message}
            />
            <TextField
              label="Carbs (g)"
              type="number"
              fullWidth
              inputProps={{ min: 0, step: 1 }}
              disabled={macroPreset !== "custom"}
              {...register("dailyCarbsG", { valueAsNumber: true })}
              error={!!errors.dailyCarbsG}
              helperText={errors.dailyCarbsG?.message}
            />
            <TextField
              label="Fat (g)"
              type="number"
              fullWidth
              inputProps={{ min: 0, step: 1 }}
              disabled={macroPreset !== "custom"}
              {...register("dailyFatG", { valueAsNumber: true })}
              error={!!errors.dailyFatG}
              helperText={errors.dailyFatG?.message}
            />
          </Stack>
        </Stack>

        <Divider />

        <Stack spacing={2}>
          <Typography variant="h6">Water</Typography>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <TextField
              label="Daily water (ml)"
              type="number"
              fullWidth
              inputProps={{ min: 0, step: 50 }}
              {...register("dailyWaterMl", { valueAsNumber: true })}
              error={!!errors.dailyWaterMl}
              helperText={errors.dailyWaterMl?.message}
            />
            <Button
              type="button"
              variant="outlined"
              onClick={applyDefaultWater}
              disabled={profile.weightKg == null}
              sx={{ flexShrink: 0, mt: 1 }}
            >
              Use 35 ml/kg
            </Button>
          </Stack>
        </Stack>

        <Divider />

        <Stack spacing={2}>
          <Typography variant="h6">Sleep</Typography>
          <TextField
            label="Sleep target (hours)"
            type="number"
            fullWidth
            inputProps={{ min: 0, max: 24, step: 0.25 }}
            {...register("sleepHoursTarget", { valueAsNumber: true })}
            error={!!errors.sleepHoursTarget}
            helperText={errors.sleepHoursTarget?.message}
          />
        </Stack>

        <Divider />

        <Stack spacing={2}>
          <Typography variant="h6">Target weight (optional)</Typography>
          <Controller
            control={control}
            name="targetWeightKg"
            render={({ field }) => (
              <TextField
                label="Target weight (kg)"
                type="number"
                fullWidth
                inputProps={{ min: 0, step: 0.1 }}
                value={field.value ?? ""}
                onChange={(e) =>
                  field.onChange(e.target.value === "" ? null : Number(e.target.value))
                }
                error={!!errors.targetWeightKg}
                helperText={errors.targetWeightKg?.message}
              />
            )}
          />
        </Stack>

        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ pt: 1 }}>
          <Button type="submit" variant="contained" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? "Saving…" : "Save goals"}
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
