import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { authOptions } from "@/lib/auth/options";
import { FoodForm, type FoodFormValues } from "../food-form";

export const dynamic = "force-dynamic";

const EMPTY_FOOD: FoodFormValues = {
  name: "",
  brand: null,
  servingSize: 100,
  servingUnit: "g",
  caloriesPerServing: 0,
  macrosPerServing: { proteinG: 0, carbsG: 0, fatG: 0, fiberG: null, sugarG: null },
  isFavorite: false,
};

export default async function NewFoodPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/foods/new");

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 6 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography component="h1" variant="h4" sx={{ fontWeight: 600 }}>
          Add food
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Saved to your personal database — only you can see it.
        </Typography>
      </Box>
      <FoodForm mode="create" initialValues={EMPTY_FOOD} />
    </Container>
  );
}
