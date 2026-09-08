/**
 * @file Indica a Drizzle dónde están el esquema SQLite y las migraciones generadas.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "sqlite",
});
