/**
 * @file API que elimina la sesión local y la cookie del navegador.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
import { clearSessionCookie, destroySession } from "@/app/supabase-auth";

export const dynamic = "force-dynamic";

/** Manejador HTTP de lectura: reúne inventario, pedidos, facturas, cobros, catálogos, entregas y permisos para la interfaz. */
export async function GET(request: Request) {
  await destroySession(request).catch(() => undefined);
  const response = Response.redirect(new URL("/", request.url), 303);
  response.headers.append("set-cookie", clearSessionCookie());
  return response;
}
