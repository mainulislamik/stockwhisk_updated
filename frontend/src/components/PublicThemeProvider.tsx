"use client";

import { ThemeProvider } from "@mui/material/styles";
import { getTheme } from "@/theme";

// Public/marketing pages are always light, regardless of the app's saved dark
// mode. This forces a light MUI theme so MUI inputs (TextField, Switch, etc.)
// render light too — the page-level colors alone don't affect MUI components.
const lightTheme = getTheme("light");

export default function PublicThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}
