import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { authOptions } from "@/lib/auth/options";
import { MeasurementsForm } from "../measurements-form";

export const dynamic = "force-dynamic";

export default async function NewMeasurementPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/measurements/new");

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, sm: 6 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography component="h1" variant="h4" sx={{ fontWeight: 600 }}>
          Log measurements
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Fill in only the metrics you want to record today — the rest stay empty.
        </Typography>
      </Box>
      <MeasurementsForm />
    </Container>
  );
}
