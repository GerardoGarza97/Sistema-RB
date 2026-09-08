# Sistema Reyes Barreda

Respaldo documentado del sistema de Alimentos Congelados Reyes Barreda. Administra inventario por lote, compras, calidad, pedidos, facturación, cobros, entregas, cuentas y auditoría según el rol de cada usuario.

> La documentación y los comentarios de este respaldo no modifican la lógica del sistema. El código ejecutable corresponde a la versión actual exportada.

## Tecnologías

- TypeScript, React 19 y Next.js 16 mediante Vinext.
- Vite para desarrollo y compilación.
- Cloudflare Workers para ejecutar el servidor.
- Cloudflare D1 como base de datos SQLite.
- Drizzle ORM para definir y consultar el esquema.
- Supabase Auth para usuarios, contraseñas y perfiles.
- Tailwind CSS y componentes accesibles basados en Radix UI.
- ExcelJS y SheetJS para importar y exportar hojas de cálculo.

## Lo necesario para ejecutarlo

- Node.js 22.13 o posterior.
- npm, incluido con Node.js.
- Linux o WSL para usar directamente los scripts de instalación y compilación incluidos.
- Un proyecto Supabase con la función `rb-account-admin` desplegada.
- Una base Cloudflare D1 vinculada como `DB` al publicar.

No se guarda `node_modules` en GitHub. Todas las dependencias y sus versiones exactas están en `package.json` y `package-lock.json`; se reconstruyen con `npm ci`.

## Primer arranque

1. Clona este repositorio.
2. Copia `.env.example` como `.env.local`.
3. Coloca la URL y la llave publicable de tu proyecto Supabase.
4. Ejecuta `npm ci` en un entorno Node.js compatible. En el entorno de Sites se usa `npm run install:ci`.
5. Ejecuta `npm run dev` para desarrollo o `npm run build` para comprobar una compilación de producción.

```bash
git clone https://github.com/GerardoGarza97/Sistema-RB.git
cd Sistema-RB
cp .env.example .env.local
npm ci
npm run dev
```

## Variables de entorno

| Variable | Uso | Se puede publicar |
|---|---|---|
| `SUPABASE_URL` | Dirección del proyecto Supabase | Sí, no es una contraseña |
| `SUPABASE_PUBLISHABLE_KEY` | Llave publicable usada por la aplicación | Sí, siempre que las políticas de Supabase estén bien configuradas |
| `SUPABASE_SERVICE_ROLE_KEY` | Administración de cuentas dentro de la función Edge | **No**; solo debe existir como secreto de Supabase |

Nunca subas `.env.local`, contraseñas, tokens de sesión o la llave `service_role`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Inicia el entorno local de Vite/Vinext. |
| `npm run build` | Compila la aplicación y prepara el Worker. |
| `npm run lint` | Revisa TypeScript, React y reglas de estilo. |
| `npm test` | Compila y ejecuta las pruebas del proyecto. |
| `npm run db:generate` | Genera una migración después de cambiar `db/schema.ts`. |

## Recorrido recomendado para entender el proyecto

1. Lee [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
2. Ubica cada archivo en [docs/FILE_GUIDE.md](docs/FILE_GUIDE.md).
3. Revisa las tablas en [docs/DATABASE.md](docs/DATABASE.md).
4. Antes de cambiar algo, consulta [docs/MODIFICATION_GUIDE.md](docs/MODIFICATION_GUIDE.md).
5. Para cuentas y secretos, consulta [docs/SECURITY.md](docs/SECURITY.md).

## Datos reales

Este repositorio contiene la estructura y la lógica, pero no una copia de los registros reales de producción. Los productos, pedidos, usuarios operativos, facturas y movimientos viven en Cloudflare D1 y Supabase. Mantenerlos fuera del repositorio evita publicar información privada accidentalmente.

## Estructura rápida

```text
app/                  Pantallas, autenticación y rutas API
components/ui/        Componentes visuales reutilizables
db/                   Esquema y conexión con D1
drizzle/              Historial de migraciones SQLite
lib/                  Utilidades y generación de Excel
public/               Logo, fondo, icono y plantilla Excel
supabase/functions/   Administración segura de cuentas
worker/               Entrada del Cloudflare Worker
docs/                 Guías para entender y modificar el sistema
```
