/**
 * @file Ruta principal del sitio; entrega el control al contenedor de autenticación.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
import AuthShell from "./auth-shell";

export const dynamic = "force-dynamic";

/** Renderiza la página principal y delega el acceso a AuthShell. */
export default function Home() {
  return <AuthShell />;
}
