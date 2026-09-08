/**
 * @file API para cambiar el nombre de usuario conservando la misma cuenta.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
import { and, eq, ne, or } from "drizzle-orm";
import { callAccountAdmin, getSessionProfile, normalizeUsername, requireSameOrigin, signIn, validUsername } from "@/app/supabase-auth";
import { getDb } from "@/db";
import { appUsers, movements } from "@/db/schema";

export const dynamic = "force-dynamic";

/** Manejador HTTP de escritura: valida el rol y dirige cada acción a su bloque transaccional correspondiente. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { profile, user } = await getSessionProfile(request);
    const body = await request.json() as Record<string, unknown>;
    const currentPassword = String(body.currentPassword ?? "");
    const username = normalizeUsername(body.username);

    if (!currentPassword) throw new Error("Escribe tu contraseña actual.");
    if (!validUsername(username)) throw new Error("El usuario debe tener de 3 a 32 caracteres: letras minúsculas, números, punto, guion o guion bajo.");
    if (username === profile.username) throw new Error("Elige un nombre de usuario diferente al actual.");

    try {
      await signIn(profile.username, currentPassword, profile.role);
    } catch {
      throw new Error("La contraseña actual no es correcta.");
    }

    const db = getDb();
    const [duplicate] = await db.select({ id: appUsers.id }).from(appUsers).where(and(
      ne(appUsers.id, user.id),
      or(eq(appUsers.username, username), eq(appUsers.email, username)),
    )).limit(1);
    if (duplicate) throw new Error("Ese nombre de usuario ya existe.");

    const remote = await callAccountAdmin(request, { action: "CHANGE_USERNAME", username });
    const savedUsername = normalizeUsername(remote.username ?? username);
    await db.update(appUsers).set({ username: savedUsername }).where(eq(appUsers.id, user.id));
    await db.insert(movements).values({
      action: "NOMBRE_USUARIO_MODIFICADO",
      entityType: "USUARIO",
      entityId: user.id,
      details: `${profile.username} → ${savedUsername}`,
      actorEmail: user.email,
      actorName: user.displayName,
      actorRole: user.role,
    });

    return Response.json({
      ok: true,
      profile: { ...profile, username: savedUsername },
      message: `Tu nombre de usuario ahora es ${savedUsername}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible cambiar el nombre de usuario.";
    const status = message === "AUTH_REQUIRED" ? 401 : message === "INVALID_ORIGIN" ? 403 : 400;
    const text = message === "AUTH_REQUIRED" ? "La sesión venció. Vuelve a ingresar." : message === "INVALID_ORIGIN" ? "Solicitud no permitida." : message;
    return Response.json({ error: text }, { status });
  }
}
