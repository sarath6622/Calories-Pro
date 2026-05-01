import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

export default function HomePage() {
  return (
    <Container maxWidth="sm" sx={{ py: { xs: 6, sm: 10 } }}>
      <Box component="main">
        <Typography component="h1" variant="h3" sx={{ fontWeight: 600 }}>
          CaloriesPro
        </Typography>
        <Typography variant="body1" sx={{ mt: 2, color: "text.secondary" }}>
          Calorie &amp; Wellness Tracker — Phase 0 scaffold.
        </Typography>
      </Box>
    </Container>
  );
}
