import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { authOptions } from "@/lib/auth/options";
import { connectDb } from "@/lib/db";
import { Food } from "@/lib/models/Food";
import { FoodForm, type FoodFormValues } from "../../food-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

export default async function EditFoodPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect(`/login?callbackUrl=/foods/${params.id}/edit`);

  if (!mongoose.isValidObjectId(params.id)) notFound();

  await connectDb();
  const food = await Food.findById(params.id);
  if (!food) notFound();

  const isAdmin = session.user.role === "admin";
  if (!isAdmin && food.userId.toString() !== session.user.id) notFound();

  const initialValues: FoodFormValues = {
    name: food.name,
    brand: food.brand ?? null,
    servingSize: food.servingSize,
    servingUnit: food.servingUnit,
    caloriesPerServing: food.caloriesPerServing,
    macrosPerServing: {
      proteinG: food.macrosPerServing.proteinG,
      carbsG: food.macrosPerServing.carbsG,
      fatG: food.macrosPerServing.fatG,
      fiberG: food.macrosPerServing.fiberG ?? null,
      sugarG: food.macrosPerServing.sugarG ?? null,
    },
    isFavorite: food.isFavorite,
  };

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 6 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography component="h1" variant="h4" sx={{ fontWeight: 600 }}>
          Edit food
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Past log entries keep their nutrition snapshot — your edits don&apos;t affect history.
        </Typography>
      </Box>
      <FoodForm mode="edit" initialValues={initialValues} foodId={params.id} />
    </Container>
  );
}
