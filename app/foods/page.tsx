import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Link from "next/link";
import { authOptions } from "@/lib/auth/options";
import { FoodsList } from "./foods-list";

export const dynamic = "force-dynamic";

export default async function FoodsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/foods");

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, sm: 6 } }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography component="h1" variant="h4" sx={{ fontWeight: 600 }}>
            Foods
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your personal food database.
          </Typography>
        </Box>
        <Button
          component={Link}
          href="/foods/new"
          variant="contained"
          sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
        >
          Add food
        </Button>
      </Stack>
      <FoodsList />
    </Container>
  );
}
