/**
 * @file Crea el cliente Drizzle usando la vinculación DB de Cloudflare D1.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/** Devuelve el cliente tipado de Drizzle y detiene la operación si la vinculación D1 no está disponible. */
export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}
