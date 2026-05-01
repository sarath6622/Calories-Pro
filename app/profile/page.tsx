import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { authOptions } from "@/lib/auth/options";
import { connectDb } from "@/lib/db";
import { User } from "@/lib/models/User";
import { ProfileForm, type ProfileFormValues } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/profile");

  await connectDb();
  const user = await User.findById(session.user.id);
  if (!user) redirect("/login");

  const initialValues: ProfileFormValues = {
    name: user.name,
    email: user.email,
    dateOfBirth: user.profile?.dateOfBirth
      ? new Date(user.profile.dateOfBirth).toISOString().slice(0, 10)
      : "",
    sex: user.profile?.sex ?? "other",
    heightCm: user.profile?.heightCm ?? null,
    activityLevel: user.profile?.activityLevel ?? "sedentary",
    timezone: user.profile?.timezone ?? "UTC",
    units: {
      weight: user.profile?.units?.weight ?? "kg",
      height: user.profile?.units?.height ?? "cm",
      water: user.profile?.units?.water ?? "ml",
    },
  };

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 8 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography component="h1" variant="h4" sx={{ fontWeight: 600 }}>
          Your profile
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Used for BMR / TDEE calculations and unit display.
        </Typography>
      </Box>
      <ProfileForm initialValues={initialValues} />
    </Container>
  );
}
