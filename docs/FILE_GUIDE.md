# Guía de archivos

Los archivos TypeScript, TSX, JavaScript, CSS, SQL y shell incluyen comentarios dentro del propio código. JSON, imágenes y Excel no admiten comentarios seguros; por eso se explican aquí.

## Aplicación

| Archivo | Función |
|---|---|
| `app/page.tsx` | Página raíz que abre `AuthShell`. |
| `app/layout.tsx` | Metadatos, viewport móvil, idioma, estilos y tema global. |
| `app/auth-shell.tsx` | Sesión, formulario de acceso y cambio obligatorio de contraseña. |
| `app/dashboard.tsx` | Panel principal y módulos visibles según el rol. |
| `app/bulk-cash-outflow.tsx` | Pedido a proveedor con varias partidas y una sola salida de dinero. |
| `app/supplier-receipts.tsx` | Validación física de entradas por Calidad. |
| `app/supabase-auth.ts` | Cookies, sesiones, tokens y comunicación con Supabase. |
| `app/theme-provider.tsx` | Tema claro u oscuro. |
| `app/globals.css` | Diseño global, estados, tablas, formularios y adaptación móvil. |

## API

| Archivo | Función |
|---|---|
| `app/api/system/route.ts` | API única del negocio. `GET` reúne datos y `POST` procesa acciones. |
| `app/api/auth/login/route.ts` | Valida usuario, contraseña y rol; crea la sesión. |
| `app/api/auth/logout/route.ts` | Destruye la sesión. |
| `app/api/auth/session/route.ts` | Devuelve el perfil de la sesión activa. |
| `app/api/auth/change-password/route.ts` | Cambia o establece la contraseña personal. |
| `app/api/auth/change-username/route.ts` | Cambia el usuario visible y técnico. |

## Datos

| Archivo o carpeta | Función |
|---|---|
| `db/index.ts` | Crea el cliente Drizzle con la vinculación `DB`. |
| `db/schema.ts` | Fuente principal de tablas e índices. |
| `drizzle/0000_*.sql` a `drizzle/0012_*.sql` | Migraciones ordenadas; reproducen la evolución del esquema. |
| `drizzle/meta/*_snapshot.json` | Fotografías generadas por Drizzle para calcular migraciones futuras. |
| `drizzle/meta/_journal.json` | Orden e identidad de las migraciones. |
| `drizzle.config.ts` | Configuración SQLite para generar migraciones. |

No agregues comentarios a los JSON de `drizzle/meta`: dejarían de ser JSON válido.

## Interfaz compartida

`components/ui/` contiene primitivas reutilizables. Cada archivo encapsula un control con estructura, accesibilidad y estilos: `accordion`, `alert-dialog`, `alert`, `aspect-ratio`, `attachment`, `avatar`, `badge`, `breadcrumb`, `bubble`, `button-group`, `button`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `combobox`, `command`, `context-menu`, `dialog`, `direction`, `drawer`, `dropdown-menu`, `empty`, `field`, `form`, `hover-card`, `input-group`, `input-otp`, `input`, `item`, `kbd`, `label`, `marker`, `menubar`, `message-scroller`, `message`, `native-select`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `sonner`, `spinner`, `switch`, `table`, `tabs`, `textarea`, `toggle-group`, `toggle` y `tooltip`.

Normalmente no necesitas modificar estos archivos. Cambia la composición en `app/` y los estilos en `app/globals.css`.

## Utilidades, ejecución y configuración

| Archivo | Función |
|---|---|
| `lib/cobranza-excel.ts` | Crea el Excel del historial de facturas y cobros. |
| `lib/utils.ts` | Combina clases de Tailwind. |
| `hooks/use-mobile.ts` | Detecta el ancho móvil. |
| `worker/index.ts` | Entrada del Worker y optimización de imágenes. |
| `build/sites-vite-plugin.ts` | Empaqueta `hosting.json` y migraciones después del build. |
| `vite.config.ts` | Vinext, Vite, Worker, D1 y entorno de vista previa. |
| `next.config.ts` | Opciones compatibles con Next.js. |
| `postcss.config.mjs` | Procesamiento de Tailwind CSS. |
| `eslint.config.mjs` | Reglas del análisis estático. |
| `tsconfig.json` | Opciones del compilador y alias `@/`. |
| `components.json` | Configuración del catálogo de componentes. |
| `.openai/hosting.json` | Identidad del Site y nombre lógico de D1. |
| `package.json` | Comandos y dependencias directas. |
| `package-lock.json` | Versiones exactas y hashes de todas las dependencias transitivas. |
| `.npmrc` | Configuración de npm para instalar de forma reproducible. |
| `.gitignore` | Evita subir secretos, dependencias y archivos generados. |

## Scripts y pruebas

| Archivo | Función |
|---|---|
| `scripts/sites-env.sh` | Prepara carpetas temporales y variables locales seguras. |
| `scripts/install-ci.sh` | Instala dependencias bloqueadas con verificaciones de integridad. |
| `scripts/build-verified.sh` | Compila con tiempo máximo controlado. |
| `scripts/add-documentation-headers.mjs` | Añade únicamente comentarios a esta copia documentada. |
| `tests/rendered-html.test.mjs` | Comprueba estructura y seguridad del resultado compilado. |
| `tests/ui-components.test.mjs` | Comprueba convenciones de componentes y CSS. |

## Archivos públicos

| Archivo | Función |
|---|---|
| `public/logo-reyes-barreda.jpg` | Logotipo mostrado en acceso y barra lateral. |
| `public/fondo-login-helados.webp` | Fondo del inicio de sesión. |
| `public/favicon.svg` | Icono del navegador. |
| `public/plantilla-inventario-reyes-barreda.xlsx` | Plantilla para importar entradas de inventario. |

## Supabase

`supabase/functions/rb-account-admin/index.ts` es la función Edge que administra identidades. Debe desplegarse en Supabase y recibir `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SERVICE_ROLE_KEY` como secretos del servidor.

## Archivos que no se incluyen

- `node_modules/`: se reconstruye con `npm ci`.
- `dist/`, `.next/`: se reconstruyen con `npm run build`.
- `.env.local`: contendría valores del entorno.
- `.wrangler/` y `.sites-runtime/`: cachés y estado temporal de desarrollo.
- Registros reales de D1 o usuarios de Supabase: son datos externos, no código fuente.
