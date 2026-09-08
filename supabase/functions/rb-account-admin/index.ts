/**
 * @file Función Edge protegida que crea, actualiza, desactiva y elimina cuentas en Supabase Auth.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ROLES = ["ADMIN", "COMPRAS", "CALIDAD", "CAJA", "VENDEDOR", "ALMACEN", "PRODUCCION"] as const;
const LIMITS: Record<string, number> = { ADMIN: 4, COMPRAS: 2, CALIDAD: 1, CAJA: 1, VENDEDOR: 4, ALMACEN: 1, PRODUCCION: 1 };
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/;
/** Función auxiliar `json`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});
/** Normaliza un nombre de usuario a minúsculas y elimina espacios externos. */
const normalizeUsername = (value: unknown) => String(value ?? "").trim().toLowerCase();
/** Convierte el usuario visible en el correo técnico utilizado internamente por Supabase Auth. */
const loginEmail = (username: string) => `${username}@cuentas.reyesbarreda.mx`;
/** Comprueba la longitud mínima y la presencia de letras y números. */
const validPassword = (password: string) => password.length >= 7 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json({ error: "Sesión requerida." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "La sesión venció. Vuelve a ingresar." }, 401);

  const { data: caller, error: callerError } = await admin.from("rb_profiles")
    .select("id,username,display_name,role,active,must_change_password")
    .eq("id", authData.user.id)
    .single();
  if (callerError || !caller || !caller.active) return json({ error: "Cuenta desactivada o no asignada." }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Solicitud inválida." }, 400); }
  const action = String(body.action ?? "");

  if (action === "CHANGE_PASSWORD") {
    const password = String(body.password ?? "");
    if (!validPassword(password)) return json({ error: "La contraseña debe tener al menos 7 caracteres, con letras y números." }, 400);
    const { error } = await admin.auth.admin.updateUserById(caller.id, { password });
    if (error) return json({ error: "No fue posible cambiar la contraseña." }, 400);
    await admin.from("rb_profiles").update({ must_change_password: false, updated_at: new Date().toISOString() }).eq("id", caller.id);
    return json({ ok: true, message: "Contraseña actualizada." });
  }

  if (action === "CHANGE_USERNAME") {
    const username = normalizeUsername(body.username);
    if (!USERNAME.test(username)) return json({ error: "El usuario debe tener de 3 a 32 caracteres: letras minúsculas, números, punto, guion o guion bajo." }, 400);
    if (username === caller.username) return json({ error: "Elige un nombre de usuario diferente al actual." }, 400);

    const { data: duplicate, error: duplicateError } = await admin.from("rb_profiles").select("id").eq("username", username).neq("id", caller.id).maybeSingle();
    if (duplicateError) return json({ error: "No fue posible comprobar si el nombre de usuario está disponible." }, 400);
    if (duplicate) return json({ error: "Ese nombre de usuario ya existe." }, 400);

    const updatedAt = new Date().toISOString();
    const { error: profileError } = await admin.from("rb_profiles").update({ username, updated_at: updatedAt }).eq("id", caller.id);
    if (profileError) return json({ error: profileError.code === "23505" ? "Ese nombre de usuario ya existe." : "No fue posible cambiar el nombre de usuario." }, 400);

    const { error: authUpdateError } = await admin.auth.admin.updateUserById(caller.id, {
      email: loginEmail(username),
      email_confirm: true,
      user_metadata: { ...authData.user.user_metadata, username },
    });
    if (authUpdateError) {
      await admin.from("rb_profiles").update({ username: caller.username, updated_at: updatedAt }).eq("id", caller.id);
      const duplicateEmail = authUpdateError.message?.toLowerCase().includes("already") || authUpdateError.message?.toLowerCase().includes("registered");
      return json({ error: duplicateEmail ? "Ese nombre de usuario ya existe." : "No fue posible cambiar el nombre de usuario." }, 400);
    }

    return json({ ok: true, username, message: `Tu nombre de usuario ahora es ${username}.` });
  }

  if (caller.role !== "ADMIN") return json({ error: "Solo el Administrador puede gestionar cuentas." }, 403);

  if (action === "CREATE_ACCOUNT") {
    const username = normalizeUsername(body.username);
    const displayName = String(body.displayName ?? "").trim();
    const role = String(body.role ?? "").toUpperCase();
    const password = String(body.password ?? "");
    if (!USERNAME.test(username)) return json({ error: "El usuario debe tener de 3 a 32 caracteres: letras minúsculas, números, punto, guion o guion bajo." }, 400);
    if (!displayName || !ROLES.includes(role as typeof ROLES[number])) return json({ error: "Completa el nombre y tipo de cuenta." }, 400);
    if (!validPassword(password)) return json({ error: "La contraseña temporal debe tener al menos 7 caracteres, con letras y números." }, 400);

    const { count } = await admin.from("rb_profiles").select("id", { count: "exact", head: true }).eq("role", role).eq("active", true);
    if ((count ?? 0) >= LIMITS[role]) return json({ error: `Ya se alcanzó el límite de cuentas para ${role.toLowerCase()}.` }, 400);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: loginEmail(username),
      password,
      email_confirm: true,
      user_metadata: { username, display_name: displayName, role },
    });
    if (createError || !created.user) {
      const duplicate = createError?.message?.toLowerCase().includes("already") || createError?.message?.toLowerCase().includes("registered");
      return json({ error: duplicate ? "Ese nombre de usuario ya existe." : "No fue posible crear la cuenta." }, 400);
    }

    const { error: profileError } = await admin.from("rb_profiles").insert({
      id: created.user.id,
      username,
      display_name: displayName,
      role,
      active: true,
      must_change_password: true,
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: profileError.code === "23505" ? "Ese nombre de usuario ya existe." : "No fue posible guardar el perfil." }, 400);
    }
    return json({ ok: true, authUserId: created.user.id, username, message: "Cuenta creada con contraseña temporal." });
  }

  const targetId = String(body.authUserId ?? "");
  if (!targetId) return json({ error: "Cuenta no encontrada." }, 400);
  if (targetId === caller.id) return json({ error: "No puedes modificar tu propia cuenta desde esta opción." }, 400);

  const { data: target } = await admin.from("rb_profiles").select("id,username,display_name,role,active").eq("id", targetId).single();
  if (!target) return json({ error: "Cuenta no encontrada." }, 404);

  if (action === "TOGGLE_ACCOUNT") {
    const nextActive = !target.active;
    const { error } = await admin.from("rb_profiles").update({ active: nextActive, updated_at: new Date().toISOString() }).eq("id", targetId);
    if (error) return json({ error: "No fue posible cambiar el estado de la cuenta." }, 400);
    return json({ ok: true, active: nextActive, message: nextActive ? "Cuenta activada." : "Cuenta desactivada." });
  }

  if (action === "RESET_PASSWORD") {
    const password = String(body.password ?? "");
    if (!validPassword(password)) return json({ error: "La contraseña temporal debe tener al menos 7 caracteres, con letras y números." }, 400);
    const { error } = await admin.auth.admin.updateUserById(targetId, { password });
    if (error) return json({ error: "No fue posible restablecer la contraseña." }, 400);
    await admin.from("rb_profiles").update({ must_change_password: true, updated_at: new Date().toISOString() }).eq("id", targetId);
    return json({ ok: true, message: "Contraseña temporal actualizada." });
  }

  if (action === "DELETE_ACCOUNT") {
    if (target.role === "ADMIN") {
      const { count } = await admin.from("rb_profiles").select("id", { count: "exact", head: true }).eq("role", "ADMIN");
      if ((count ?? 0) <= 1) return json({ error: "No se puede eliminar la última cuenta de Administrador." }, 400);
    }
    const { error } = await admin.auth.admin.deleteUser(targetId);
    if (error) return json({ error: "No fue posible eliminar la cuenta." }, 400);
    return json({ ok: true, message: "Cuenta eliminada." });
  }

  return json({ error: "Acción no reconocida." }, 400);
});
