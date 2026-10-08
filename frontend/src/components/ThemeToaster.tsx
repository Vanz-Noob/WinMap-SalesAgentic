"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/lib/theme";

/** Toaster yang mengikuti tema aktif (dark/light) */
export function ThemeToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="top-right" richColors closeButton />;
}
