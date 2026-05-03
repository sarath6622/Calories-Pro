import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { authOptions } from "@/lib/auth/options";
import { MeasurementsCardsView } from "./measurements-cards-view";

export const dynamic = "force-dynamic";

export default async function MeasurementsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/measurements");

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, sm: 6 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography component="h1" variant="h4" sx={{ fontWeight: 600 }}>
          Body measurements
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Latest value of each metric, with the change since the previous entry.
        </Typography>
      </Box>
      <MeasurementsCardsView />
    </Container>
  );
}
