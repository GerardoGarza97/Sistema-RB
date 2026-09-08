/**
 * @file Controla el acceso inicial: comprueba la sesión, muestra el formulario de ingreso y obliga a cambiar contraseñas temporales.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, KeyRound, Loader2, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import Dashboard from "./dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Role = "ADMIN" | "COMPRAS" | "CALIDAD" | "CAJA" | "VENDEDOR" | "ALMACEN" | "PRODUCCION";
type Profile = { id: string; username: string; displayName: string; role: Role; active: boolean; mustChangePassword: boolean };

const roleOptions: { value: Role; label: string }[] = [
  { value: "ADMIN", label: "Administrador" },
  { value: "COMPRAS", label: "Compras" },
  { value: "CALIDAD", label: "Calidad" },
  { value: "CAJA", label: "Caja" },
  { value: "VENDEDOR", label: "Vendedor" },
  { value: "ALMACEN", label: "Almacén" },
  { value: "PRODUCCION", label: "Producción" },
];

/** Componente raíz de acceso que decide entre carga, inicio de sesión, cambio obligatorio de contraseña o sistema. */
export default function AuthShell() {
  // Mientras se comprueba la cookie no se muestra el formulario para evitar un falso estado de cierre.
  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ profile: Profile }> : null)
      .then((payload) => { if (active && payload) setProfile(payload.profile); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  if (checking) return <div className="auth-loading"><Loader2 className="spin" /><p>Comprobando acceso…</p></div>;
  if (!profile) return <LoginScreen onSuccess={setProfile} />;
  if (profile.mustChangePassword) return <PasswordChange profile={profile} onSuccess={setProfile} />;
  return <Dashboard />;
}

/** Componente del formulario de inicio de sesión. */
function LoginScreen({ onSuccess }: { onSuccess: (profile: Profile) => void }) {
  // El servidor confirma que el rol seleccionado coincida con el perfil de la cuenta.
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });
      const payload = await response.json() as { profile?: Profile; error?: string };
      if (!response.ok || !payload.profile) throw new Error(payload.error || "No fue posible iniciar sesión.");
      onSuccess(payload.profile);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible iniciar sesión.");
    } finally { setSaving(false); }
  };

  return <main className="auth-page auth-login-page">
    <div className="auth-login-stack">
      <div className="auth-login-logo"><Image src="/logo-reyes-barreda.jpg" alt="Alimentos Congelados Reyes Barreda" width={500} height={300} priority /></div>
      <section className="auth-form-panel" aria-label="Inicio de sesión">
        <form className="auth-card" onSubmit={submit}>
          <div className="auth-card-icon"><LockKeyhole /></div>
          <div className="auth-card-heading"><span>BIENVENIDO</span><h2>Iniciar sesión</h2><p>Ingresa los tres datos asignados por el Administrador.</p></div>

          <div className="auth-field"><Label htmlFor="username">Nombre de usuario</Label><div className="auth-input-wrap"><UserRound /><Input id="username" name="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} placeholder="usuario" required /></div></div>
          <div className="auth-field"><Label htmlFor="password">Contraseña</Label><div className="auth-input-wrap"><KeyRound /><Input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Contraseña asignada" required /><button type="button" className="password-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPassword ? <EyeOff /> : <Eye />}</button></div></div>
          <div className="auth-field"><Label>Tipo de cuenta</Label><Select value={role} onValueChange={(value) => setRole(value as Role)} required><SelectTrigger className="auth-select"><SelectValue placeholder="Seleccionar perfil" /></SelectTrigger><SelectContent>{roleOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>

          {error && <p className="auth-error" role="alert">{error}</p>}
          <Button type="submit" size="lg" disabled={saving || !username || !password || !role}>{saving ? <Loader2 className="spin" /> : <LockKeyhole />}{saving ? "Validando…" : "Entrar al sistema"}</Button>
          <small className="auth-help">Si olvidaste tu contraseña, solicita al Administrador una nueva contraseña temporal.</small>
        </form>
      </section>
    </div>
  </main>;
}

/** Componente para establecer la primera contraseña personal. */
function PasswordChange({ profile, onSuccess }: { profile: Profile; onSuccess: (profile: Profile) => void }) {
  // Este paso bloquea el panel mientras la cuenta todavía usa una contraseña temporal.
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password, confirmation }) });
      const payload = await response.json() as { profile?: Profile; error?: string };
      if (!response.ok || !payload.profile) throw new Error(payload.error || "No fue posible cambiar la contraseña.");
      onSuccess(payload.profile);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No fue posible cambiar la contraseña."); }
    finally { setSaving(false); }
  };

  return <main className="auth-page auth-change-page"><section className="auth-form-panel"><form className="auth-card" onSubmit={submit}>
    <div className="auth-card-icon"><KeyRound /></div>
    <div className="auth-card-heading"><span>PRIMER INGRESO</span><h2>Crea tu contraseña personal</h2><p>Hola, {profile.displayName}. La contraseña temporal debe reemplazarse antes de abrir el sistema.</p></div>
    <div className="auth-field"><Label htmlFor="new-password">Nueva contraseña</Label><Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={7} required /><small>Mínimo 7 caracteres, con letras y números.</small></div>
    <div className="auth-field"><Label htmlFor="confirmation">Confirmar contraseña</Label><Input id="confirmation" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={7} required /></div>
    {error && <p className="auth-error" role="alert">{error}</p>}
    <Button type="submit" size="lg" disabled={saving || password.length < 7 || confirmation.length < 7}>{saving ? <Loader2 className="spin" /> : <ShieldCheck />}{saving ? "Guardando…" : "Guardar y continuar"}</Button>
    <Button asChild type="button" variant="ghost"><a href="/api/auth/logout">Cerrar sesión</a></Button>
  </form></section></main>;
}
