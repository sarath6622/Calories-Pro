import type { ReactNode } from "react";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Container maxWidth="xs" sx={{ py: { xs: 4, sm: 8 } }}>
      <Box sx={{ mb: 4, textAlign: "center" }}>
        <Typography component="h1" variant="h4" sx={{ fontWeight: 600 }}>
          CaloriesPro
        </Typography>
      </Box>
      {children}
    </Container>
  );
}
