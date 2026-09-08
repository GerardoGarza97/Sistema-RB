/**
 * @file Capa de autenticación que comunica Supabase Auth con las cuentas locales y las cookies de sesión de D1.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
import { and, eq, gt, isNull } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { appUsers, authSessions } from "@/db/schema";

export type Role = "ADMIN" | "COMPRAS" | "CALIDAD" | "CAJA" | "VENDEDOR" | "ALMACEN" | "PRODUCCION";

export type AuthProfile = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
};

type SupabaseTokens = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
};

type SessionRecord = typeof authSessions.$inferSelect;

const SESSION_COOKIE = "rb_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

/** Función auxiliar `config`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
function config() {
  const runtime = env as unknown as Record<string, string | undefined>;
  const url = runtime.SUPABASE_URL;
  const key = runtime.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("AUTH_NOT_CONFIGURED");
  return { url: url.replace(/\/$/, ""), key };
}

/** Normaliza un nombre de usuario a minúsculas y elimina espacios externos. */
export function normalizeUsername(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

/** Comprueba que el usuario use únicamente el formato permitido. */
export function validUsername(username: string) {
  return USERNAME_PATTERN.test(username);
}

/** Comprueba la longitud mínima y la presencia de letras y números. */
export function validPassword(password: string) {
  return password.length >= 7 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}

/** Convierte el usuario visible en el correo técnico utilizado internamente por Supabase Auth. */
function loginEmail(username: string) {
  return `${username}@cuentas.reyesbarreda.mx`;
}

/** Busca y decodifica una cookie concreta dentro de la cabecera HTTP. */
function parseCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

/** Calcula el hash SHA-256 usado para no guardar el token de sesión en texto plano. */
async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Genera un token criptográficamente aleatorio para una sesión local. */
function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Verifica que una solicitud de escritura proceda del mismo origen del sistema. */
function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

/** Rechaza la solicitud cuando falla la protección de mismo origen. */
export function requireSameOrigin(request: Request) {
  if (!sameOrigin(request)) throw new Error("INVALID_ORIGIN");
}

/** Realiza una petición autenticada al endpoint de tokens de Supabase. */
async function tokenRequest(path: string, body: Record<string, unknown>) {
  const { url, key } = config();
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: key, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as Partial<SupabaseTokens> & { error_description?: string; msg?: string };
  if (!response.ok || !payload.access_token || !payload.refresh_token) throw new Error("INVALID_CREDENTIALS");
  return payload as SupabaseTokens;
}

/** Obtiene y normaliza el perfil de cuenta asociado con un token de Supabase. */
async function profileForToken(accessToken: string): Promise<AuthProfile> {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/rpc/rb_current_profile`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: "{}",
  });
  if (!response.ok) throw new Error("AUTH_REQUIRED");
  const rows = await response.json() as Array<{ id: string; username: string; display_name: string; role: Role; active: boolean; must_change_password: boolean }>;
  const profile = rows[0];
  if (!profile) throw new Error("ACCOUNT_NOT_ASSIGNED");
  if (!profile.active) throw new Error("ACCOUNT_DISABLED");
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    role: profile.role,
    active: profile.active,
    mustChangePassword: profile.must_change_password,
  };
}

/** Valida las credenciales y confirma que el rol elegido coincide con el perfil guardado. */
export async function signIn(usernameValue: unknown, passwordValue: unknown, roleValue: unknown) {
  const username = normalizeUsername(usernameValue);
  const password = String(passwordValue ?? "");
  const selectedRole = String(roleValue ?? "").toUpperCase() as Role;
  if (!validUsername(username) || !password || !["ADMIN", "COMPRAS", "CALIDAD", "CAJA", "VENDEDOR", "ALMACEN", "PRODUCCION"].includes(selectedRole)) {
    throw new Error("INVALID_CREDENTIALS");
  }
  const tokens = await tokenRequest("token?grant_type=password", { email: loginEmail(username), password });
  const profile = await profileForToken(tokens.access_token);
  if (profile.username !== username || profile.role !== selectedRole) throw new Error("INVALID_CREDENTIALS");
  return { profile, tokens };
}

/** Relaciona la identidad de Supabase con el registro operativo equivalente en D1. */
async function linkAppUser(profile: AuthProfile) {
  const db = getDb();
  let [user] = await db.select().from(appUsers).where(eq(appUsers.authUserId, profile.id)).limit(1);
  if (!user) [user] = await db.select().from(appUsers).where(eq(appUsers.username, profile.username)).limit(1);
  if (!user) [user] = await db.select().from(appUsers).where(eq(appUsers.email, profile.username)).limit(1);
  if (!user) {
    const candidates = await db.select().from(appUsers).where(and(eq(appUsers.role, profile.role), isNull(appUsers.authUserId)));
    user = candidates.find((candidate) => candidate.displayName.toLowerCase() === profile.displayName.toLowerCase()) ?? (candidates.length === 1 ? candidates[0] : undefined);
  }
  if (user) {
    [user] = await db.update(appUsers).set({
      username: profile.username,
      authUserId: profile.id,
      displayName: profile.displayName,
      role: profile.role,
      active: profile.active,
    }).where(eq(appUsers.id, user.id)).returning();
    return user;
  }
  [user] = await db.insert(appUsers).values({
    email: profile.username,
    username: profile.username,
    authUserId: profile.id,
    displayName: profile.displayName,
    role: profile.role,
    active: profile.active,
  }).returning();
  return user;
}

/** Reemplaza sesiones anteriores y guarda una nueva sesión local con token cifrado mediante hash. */
export async function createSession(profile: AuthProfile, tokens: SupabaseTokens) {
  const db = getDb();
  const user = await linkAppUser(profile);
  const rawToken = randomToken();
  const tokenHash = await sha256(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  await db.delete(authSessions).where(eq(authSessions.appUserId, user.id));
  await db.insert(authSessions).values({
    tokenHash,
    appUserId: user.id,
    authUserId: profile.id,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
  });
  return { rawToken, user, expiresAt };
}

/** Construye la cookie segura que identifica la sesión del navegador. */
export function sessionCookie(rawToken: string) {
  return `${SESSION_COOKIE}=${encodeURIComponent(rawToken)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

/** Construye una cookie vencida para cerrar la sesión del navegador. */
export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

/** Valida la cookie y devuelve la sesión y el usuario local activos. */
export async function getLocalSession(request: Request) {
  const rawToken = parseCookie(request, SESSION_COOKIE);
  if (!rawToken) throw new Error("AUTH_REQUIRED");
  const tokenHash = await sha256(rawToken);
  const db = getDb();
  const [session] = await db.select().from(authSessions).where(and(eq(authSessions.tokenHash, tokenHash), gt(authSessions.expiresAt, new Date().toISOString()))).limit(1);
  if (!session) throw new Error("AUTH_REQUIRED");
  const [user] = await db.select().from(appUsers).where(eq(appUsers.id, session.appUserId)).limit(1);
  if (!user) throw new Error("AUTH_REQUIRED");
  if (!user.active) throw new Error("ACCOUNT_DISABLED");
  return { session, user, rawToken };
}

/** Renueva los tokens de Supabase y actualiza la sesión almacenada. */
async function refreshedSession(session: SessionRecord) {
  const tokens = await tokenRequest("token?grant_type=refresh_token", { refresh_token: session.refreshToken });
  await getDb().update(authSessions).set({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token }).where(eq(authSessions.id, session.id));
  return { ...session, accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
}

/** Obtiene el perfil actual y renueva automáticamente el token cuando sea necesario. */
export async function getSessionProfile(request: Request) {
  const local = await getLocalSession(request);
  try {
    return { ...local, profile: await profileForToken(local.session.accessToken) };
  } catch {
    const session = await refreshedSession(local.session);
    return { ...local, session, profile: await profileForToken(session.accessToken) };
  }
}

/** Elimina de D1 la sesión asociada con la cookie actual. */
export async function destroySession(request: Request) {
  const rawToken = parseCookie(request, SESSION_COOKIE);
  if (!rawToken) return;
  await getDb().delete(authSessions).where(eq(authSessions.tokenHash, await sha256(rawToken)));
}

/** Llama a la función Edge de administración de cuentas usando el token del administrador. */
async function invokeAccountAdmin(accessToken: string, payload: Record<string, unknown>) {
  const { url, key } = config();
  const response = await fetch(`${url}/functions/v1/rb-account-admin`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; message?: string; authUserId?: string; active?: boolean; username?: string };
  return { response, result };
}

/** Protege y reintenta la llamada administrativa cuando el token necesita renovación. */
export async function callAccountAdmin(request: Request, payload: Record<string, unknown>) {
  requireSameOrigin(request);
  let { session } = await getLocalSession(request);
  let call = await invokeAccountAdmin(session.accessToken, payload);
  if (call.response.status === 401) {
    session = await refreshedSession(session);
    call = await invokeAccountAdmin(session.accessToken, payload);
  }
  if (!call.response.ok) throw new Error(call.result.error || "No fue posible administrar la cuenta.");
  return call.result;
}
