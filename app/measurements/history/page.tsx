import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { authOptions } from "@/lib/auth/options";
import { MeasurementsHistoryView } from "./measurements-history-view";

export const dynamic = "force-dynamic";

export default async function MeasurementsHistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/measurements/history");

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, sm: 6 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography component="h1" variant="h4" sx={{ fontWeight: 600 }}>
          Measurement history
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Trend chart for the metric you pick, over the selected range.
        </Typography>
      </Box>
      <MeasurementsHistoryView />
    </Container>
  );
}
