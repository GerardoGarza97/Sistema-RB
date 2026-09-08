/**
 * @file Proveedor global del tema claro u oscuro.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Conecta next-themes con toda la aplicación y evita parpadeos al cargar el tema. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false}>{children}</NextThemesProvider>;
}
