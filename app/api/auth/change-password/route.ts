/**
 * @file API para reemplazar la contraseña temporal o cambiar la contraseña personal.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
import { callAccountAdmin, getSessionProfile, requireSameOrigin, signIn, validPassword } from "@/app/supabase-auth";

export const dynamic = "force-dynamic";

/** Manejador HTTP de escritura: valida el rol y dirige cada acción a su bloque transaccional correspondiente. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { profile } = await getSessionProfile(request);
    const body = await request.json() as Record<string, unknown>;
    const currentPassword = String(body.currentPassword ?? "");
    const password = String(body.password ?? "");
    const confirmation = String(body.confirmation ?? "");
    if (!validPassword(password)) throw new Error("La contraseña debe tener al menos 7 caracteres, con letras y números.");
    if (password !== confirmation) throw new Error("Las contraseñas no coinciden.");
    if (!profile.mustChangePassword) {
      if (!currentPassword) throw new Error("Escribe tu contraseña actual.");
      if (currentPassword === password) throw new Error("La contraseña nueva debe ser diferente a la actual.");
      try {
        await signIn(profile.username, currentPassword, profile.role);
      } catch {
        throw new Error("La contraseña actual no es correcta.");
      }
    }
    await callAccountAdmin(request, { action: "CHANGE_PASSWORD", password });
    return Response.json({ ok: true, profile: { ...profile, mustChangePassword: false }, message: "Contraseña actualizada." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible cambiar la contraseña.";
    const status = message === "AUTH_REQUIRED" ? 401 : 400;
    return Response.json({ error: message === "AUTH_REQUIRED" ? "La sesión venció. Vuelve a ingresar." : message }, { status });
  }
}
