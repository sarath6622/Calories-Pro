"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import { ResetPasswordSchema, type ResetPasswordInput } from "@/lib/validation/auth";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetPasswordInput) {
    setServerError(null);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setServerError(body?.error ?? "Could not reset password");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 1500);
  }

  if (!token) {
    return (
      <Stack spacing={2}>
        <Alert severity="error">Reset link is missing a token.</Alert>
        <Link href="/forgot-password">Request a new link</Link>
      </Stack>
    );
  }

  if (done) {
    return (
      <Alert severity="success">Password updated. Redirecting to sign in…</Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack spacing={2}>
        <Typography component="h2" variant="h6">
          Choose a new password
        </Typography>
        {serverError && <Alert severity="error">{serverError}</Alert>}
        <input type="hidden" {...register("token")} value={token} />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          fullWidth
          {...register("password")}
          error={!!errors.password}
          helperText={errors.password?.message ?? "At least 8 characters"}
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          fullWidth
          {...register("confirmPassword")}
          error={!!errors.confirmPassword}
          helperText={errors.confirmPassword?.message}
        />
        <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
          {isSubmitting ? "Updating…" : "Update password"}
        </Button>
      </Stack>
    </form>
  );
}

export default function ResetPasswordPage() {
  // Suspense boundary required: useSearchParams forces this subtree out of the
  // static prerender; without it, `next build` fails on /reset-password.
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
