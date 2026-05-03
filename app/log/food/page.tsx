import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { authOptions } from "@/lib/auth/options";
import { FoodLogView } from "./food-log-view";

export const dynamic = "force-dynamic";

export default async function FoodLogPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/log/food");

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, sm: 6 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography component="h1" variant="h4" sx={{ fontWeight: 600 }}>
          Daily food log
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Track what you eat by meal — totals update as you go.
        </Typography>
      </Box>
      <FoodLogView />
    </Container>
  );
}
