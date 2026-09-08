/**
 * @file Diseño raíz de Next.js; declara metadatos, viewport móvil, estilos globales y proveedor de tema.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "./theme-provider";

export const metadata: Metadata = {
  title: "Reyes Barreda | Sistema de Almacén y Ventas",
  description: "Sistema de Alimentos Congelados Reyes Barreda para inventario, pedidos, caja, facturación, cobros y bitácora por usuario.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/** Envuelve todas las páginas con idioma, estilos y tema global. */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" suppressHydrationWarning><body className="antialiased"><ThemeProvider>{children}</ThemeProvider></body></html>;
}
