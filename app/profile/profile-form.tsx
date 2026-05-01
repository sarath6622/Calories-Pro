"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import {
  ACTIVITY_LEVELS,
  HEIGHT_UNITS,
  SEX_VALUES,
  WATER_UNITS,
  WEIGHT_UNITS,
  type ActivityLevel,
  type Sex,
} from "@/lib/models/user-enums";
import { ProfileUpdateSchema } from "@/lib/validation/profile";

export interface ProfileFormValues {
  name: string;
  email: string;
  dateOfBirth: string;
  sex: Sex;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel;
  timezone: string;
  units: {
    weight: (typeof WEIGHT_UNITS)[number];
    height: (typeof HEIGHT_UNITS)[number];
    water: (typeof WATER_UNITS)[number];
  };
}

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary (little exercise)",
  light: "Light (1–3 days / week)",
  moderate: "Moderate (3–5 days / week)",
  active: "Active (6–7 days / week)",
  very_active: "Very active (twice daily / heavy work)",
};

export function ProfileForm({ initialValues }: { initialValues: ProfileFormValues }) {
  const [status, setStatus] = useState<{ kind: "ok" | "err"; message: string } | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(ProfileUpdateSchema.passthrough()),
    defaultValues: initialValues,
  });

  async function onSubmit(values: ProfileFormValues) {
    setStatus(null);
    const payload = {
      name: values.name,
      dateOfBirth: values.dateOfBirth || null,
      sex: values.sex,
      heightCm: values.heightCm,
      weightKg: values.weightKg,
      activityLevel: values.activityLevel,
      timezone: values.timezone,
      units: values.units,
    };
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setStatus({ kind: "err", message: body?.error ?? "Could not update profile" });
      return;
    }
    setStatus({ kind: "ok", message: "Profile saved." });
    reset(values);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack spacing={2}>
        {status && (
          <Alert severity={status.kind === "ok" ? "success" : "error"}>{status.message}</Alert>
        )}

        <TextField
          label="Email"
          value={initialValues.email}
          disabled
          fullWidth
          helperText="Email is permanent on this account."
        />

        <TextField
          label="Name"
          fullWidth
          {...register("name")}
          error={!!errors.name}
          helperText={errors.name?.message}
        />

        <TextField
          label="Date of birth"
          type="date"
          fullWidth
          InputLabelProps={{ shrink: true }}
          {...register("dateOfBirth")}
          error={!!errors.dateOfBirth}
          helperText={errors.dateOfBirth?.message}
        />

        <Controller
          control={control}
          name="sex"
          render={({ field }) => (
            <TextField select label="Sex" fullWidth {...field}>
              {SEX_VALUES.map((value) => (
                <MenuItem key={value} value={value}>
                  {value === "other" ? "Other / prefer not to say" : value}
                </MenuItem>
              ))}
            </TextField>
          )}
        />

        <Controller
          control={control}
          name="heightCm"
          render={({ field }) => (
            <TextField
              label="Height (cm)"
              type="number"
              fullWidth
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
              error={!!errors.heightCm}
              helperText={errors.heightCm?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="weightKg"
          render={({ field }) => (
            <TextField
              label="Weight (kg)"
              type="number"
              fullWidth
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
              error={!!errors.weightKg}
              helperText={errors.weightKg?.message ?? "Used to calculate BMR / TDEE and water goal."}
            />
          )}
        />

        <Controller
          control={control}
          name="activityLevel"
          render={({ field }) => (
            <TextField select label="Activity level" fullWidth {...field}>
              {ACTIVITY_LEVELS.map((value) => (
                <MenuItem key={value} value={value}>
                  {ACTIVITY_LABELS[value]}
                </MenuItem>
              ))}
            </TextField>
          )}
        />

        <TextField
          label="Timezone (IANA)"
          fullWidth
          {...register("timezone")}
          error={!!errors.timezone}
          helperText={errors.timezone?.message ?? "e.g. Asia/Kolkata"}
        />

        <Divider sx={{ my: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Units
          </Typography>
        </Divider>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Controller
            control={control}
            name="units.weight"
            render={({ field }) => (
              <TextField select label="Weight" fullWidth {...field}>
                {WEIGHT_UNITS.map((u) => (
                  <MenuItem key={u} value={u}>
                    {u}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          <Controller
            control={control}
            name="units.height"
            render={({ field }) => (
              <TextField select label="Height" fullWidth {...field}>
                {HEIGHT_UNITS.map((u) => (
                  <MenuItem key={u} value={u}>
                    {u}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          <Controller
            control={control}
            name="units.water"
            render={({ field }) => (
              <TextField select label="Water" fullWidth {...field}>
                {WATER_UNITS.map((u) => (
                  <MenuItem key={u} value={u}>
                    {u === "fl_oz" ? "fl oz" : u}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Stack>

        <Stack direction="row" spacing={1} justifyContent="space-between" sx={{ pt: 1 }}>
          <Button
            type="button"
            color="inherit"
            onClick={() => signOut({ callbackUrl: "/login" })}
            aria-label="Sign out"
          >
            Sign out
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
