/**
 * @file API que comprueba la sesión y devuelve el perfil activo.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
import { getSessionProfile } from "@/app/supabase-auth";

export const dynamic = "force-dynamic";

/** Manejador HTTP de lectura: reúne inventario, pedidos, facturas, cobros, catálogos, entregas y permisos para la interfaz. */
export async function GET(request: Request) {
  try {
    const { profile } = await getSessionProfile(request);
    return Response.json({ profile }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const text = message === "ACCOUNT_DISABLED" ? "Esta cuenta está desactivada." : "Sesión no iniciada.";
    return Response.json({ error: text }, { status: message === "ACCOUNT_DISABLED" ? 403 : 401, headers: { "cache-control": "no-store" } });
  }
}
