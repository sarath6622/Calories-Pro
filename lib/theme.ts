import { createTheme, type Theme } from "@mui/material/styles";

export type ThemeMode = "light" | "dark";

export function createAppTheme(mode: ThemeMode): Theme {
  return createTheme({
    palette: {
      mode,
      primary: { main: mode === "light" ? "#1976d2" : "#90caf9" },
      secondary: { main: mode === "light" ? "#9c27b0" : "#ce93d8" },
    },
    typography: {
      fontFamily:
        'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    shape: { borderRadius: 10 },
  });
}

export const lightTheme = createAppTheme("light");
export const darkTheme = createAppTheme("dark");
