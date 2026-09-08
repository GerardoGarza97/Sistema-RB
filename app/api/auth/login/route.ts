/**
 * @file API de inicio de sesión con usuario, contraseña y perfil.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
import { createSession, requireSameOrigin, sessionCookie, signIn } from "@/app/supabase-auth";

export const dynamic = "force-dynamic";

/** Función auxiliar `errorMessage`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "ACCOUNT_DISABLED") return { status: 403, text: "Esta cuenta está desactivada." };
  if (message === "ACCOUNT_NOT_ASSIGNED") return { status: 403, text: "La cuenta todavía no tiene un perfil asignado." };
  if (message === "AUTH_NOT_CONFIGURED") return { status: 503, text: "El acceso todavía se está configurando." };
  if (message === "INVALID_ORIGIN") return { status: 403, text: "Solicitud no permitida." };
  return { status: 401, text: "Usuario, contraseña o tipo de cuenta incorrectos." };
}

/** Manejador HTTP de escritura: valida el rol y dirige cada acción a su bloque transaccional correspondiente. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await request.json() as Record<string, unknown>;
    const { profile, tokens } = await signIn(body.username, body.password, body.role);
    const session = await createSession(profile, tokens);
    const response = Response.json({ ok: true, profile });
    response.headers.append("set-cookie", sessionCookie(session.rawToken));
    return response;
  } catch (error) {
    const mapped = errorMessage(error);
    return Response.json({ error: mapped.text }, { status: mapped.status });
  }
}
