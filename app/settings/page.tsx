import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { authOptions } from "@/lib/auth/options";
import { connectDb } from "@/lib/db";
import { User } from "@/lib/models/User";
import { GoalsForm, type GoalsFormData } from "./goals-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/settings");

  await connectDb();
  const user = await User.findById(session.user.id);
  if (!user) redirect("/login");

  const data: GoalsFormData = {
    profile: {
      dateOfBirth: user.profile?.dateOfBirth
        ? new Date(user.profile.dateOfBirth).toISOString()
        : null,
      sex: user.profile?.sex ?? "other",
      heightCm: user.profile?.heightCm ?? null,
      weightKg: user.profile?.weightKg ?? null,
      activityLevel: user.profile?.activityLevel ?? "sedentary",
    },
    goals: {
      dailyCalories: user.goals?.dailyCalories ?? 0,
      dailyProteinG: user.goals?.dailyProteinG ?? 0,
      dailyCarbsG: user.goals?.dailyCarbsG ?? 0,
      dailyFatG: user.goals?.dailyFatG ?? 0,
      dailyWaterMl: user.goals?.dailyWaterMl ?? 0,
      sleepHoursTarget: user.goals?.sleepHoursTarget ?? 8,
      targetWeightKg: user.goals?.targetWeightKg ?? null,
      macroPreset: (user.goals?.macroPreset as GoalsFormData["goals"]["macroPreset"]) ?? "balanced",
    },
  };

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 8 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography component="h1" variant="h4" sx={{ fontWeight: 600 }}>
          Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Goals — calories, macros, water, and sleep.
        </Typography>
      </Box>
      <GoalsForm initialData={data} />
    </Container>
  );
}
