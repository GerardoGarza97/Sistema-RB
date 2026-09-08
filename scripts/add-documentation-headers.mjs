/**
 * @file Utilidad de documentación usada para preparar este respaldo.
 * Agrega encabezados explicativos y comentarios JSDoc sin alterar instrucciones,
 * expresiones, tipos ni valores ejecutables del proyecto.
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const fileDescriptions = {
  "app/dashboard.tsx": "Panel principal del sistema: navegación por rol, inventario, pedidos, facturas, cobros, entregas, alertas y modales operativos.",
  "app/auth-shell.tsx": "Controla el acceso inicial: comprueba la sesión, muestra el formulario de ingreso y obliga a cambiar contraseñas temporales.",
  "app/bulk-cash-outflow.tsx": "Pantalla de Compras para registrar una salida de dinero con varias partidas del mismo proveedor.",
  "app/supplier-receipts.tsx": "Pantalla de Calidad para validar mercancía recibida, factura, lote, caducidad y cantidad que entra al inventario.",
  "app/supabase-auth.ts": "Capa de autenticación que comunica Supabase Auth con las cuentas locales y las cookies de sesión de D1.",
  "app/theme-provider.tsx": "Proveedor global del tema claro u oscuro.",
  "app/layout.tsx": "Diseño raíz de Next.js; declara metadatos, viewport móvil, estilos globales y proveedor de tema.",
  "app/page.tsx": "Ruta principal del sitio; entrega el control al contenedor de autenticación.",
  "app/api/system/route.ts": "API central del negocio. Lee el estado completo y procesa las operaciones autorizadas de cada módulo.",
  "app/api/auth/login/route.ts": "API de inicio de sesión con usuario, contraseña y perfil.",
  "app/api/auth/logout/route.ts": "API que elimina la sesión local y la cookie del navegador.",
  "app/api/auth/session/route.ts": "API que comprueba la sesión y devuelve el perfil activo.",
  "app/api/auth/change-password/route.ts": "API para reemplazar la contraseña temporal o cambiar la contraseña personal.",
  "app/api/auth/change-username/route.ts": "API para cambiar el nombre de usuario conservando la misma cuenta.",
  "db/schema.ts": "Esquema Drizzle de todas las tablas, relaciones, índices y valores predeterminados almacenados en Cloudflare D1.",
  "db/index.ts": "Crea el cliente Drizzle usando la vinculación DB de Cloudflare D1.",
  "lib/cobranza-excel.ts": "Genera y descarga el archivo Excel del historial de facturas y cobros.",
  "lib/utils.ts": "Funciones pequeñas compartidas por los componentes de interfaz.",
  "hooks/use-mobile.ts": "Hook que detecta si el navegador tiene el ancho definido para la experiencia móvil.",
  "worker/index.ts": "Punto de entrada del Cloudflare Worker: sirve la aplicación Vinext y la optimización de imágenes.",
  "build/sites-vite-plugin.ts": "Plugin de compilación que copia la configuración de Sites y las migraciones al paquete final.",
  "vite.config.ts": "Configuración de Vite, Vinext, Cloudflare, D1 y el entorno local de desarrollo.",
  "next.config.ts": "Configuración compatible con Next.js utilizada por Vinext.",
  "drizzle.config.ts": "Indica a Drizzle dónde están el esquema SQLite y las migraciones generadas.",
  "eslint.config.mjs": "Reglas de análisis estático para TypeScript, React y Next.js.",
  "postcss.config.mjs": "Configura PostCSS y Tailwind CSS para procesar los estilos.",
  "supabase/functions/rb-account-admin/index.ts": "Función Edge protegida que crea, actualiza, desactiva y elimina cuentas en Supabase Auth.",
  "tests/rendered-html.test.mjs": "Pruebas de seguridad y estructura del HTML compilado.",
  "tests/ui-components.test.mjs": "Pruebas de consistencia para los componentes y estilos compartidos.",
};

const functionDescriptions = {
  getDb: "Devuelve el cliente tipado de Drizzle y detiene la operación si la vinculación D1 no está disponible.",
  normalizeUsername: "Normaliza un nombre de usuario a minúsculas y elimina espacios externos.",
  validUsername: "Comprueba que el usuario use únicamente el formato permitido.",
  validPassword: "Comprueba la longitud mínima y la presencia de letras y números.",
  loginEmail: "Convierte el usuario visible en el correo técnico utilizado internamente por Supabase Auth.",
  parseCookie: "Busca y decodifica una cookie concreta dentro de la cabecera HTTP.",
  sha256: "Calcula el hash SHA-256 usado para no guardar el token de sesión en texto plano.",
  randomToken: "Genera un token criptográficamente aleatorio para una sesión local.",
  sameOrigin: "Verifica que una solicitud de escritura proceda del mismo origen del sistema.",
  requireSameOrigin: "Rechaza la solicitud cuando falla la protección de mismo origen.",
  tokenRequest: "Realiza una petición autenticada al endpoint de tokens de Supabase.",
  profileForToken: "Obtiene y normaliza el perfil de cuenta asociado con un token de Supabase.",
  signIn: "Valida las credenciales y confirma que el rol elegido coincide con el perfil guardado.",
  linkAppUser: "Relaciona la identidad de Supabase con el registro operativo equivalente en D1.",
  createSession: "Reemplaza sesiones anteriores y guarda una nueva sesión local con token cifrado mediante hash.",
  sessionCookie: "Construye la cookie segura que identifica la sesión del navegador.",
  clearSessionCookie: "Construye una cookie vencida para cerrar la sesión del navegador.",
  getLocalSession: "Valida la cookie y devuelve la sesión y el usuario local activos.",
  refreshedSession: "Renueva los tokens de Supabase y actualiza la sesión almacenada.",
  getSessionProfile: "Obtiene el perfil actual y renueva automáticamente el token cuando sea necesario.",
  destroySession: "Elimina de D1 la sesión asociada con la cookie actual.",
  invokeAccountAdmin: "Llama a la función Edge de administración de cuentas usando el token del administrador.",
  callAccountAdmin: "Protege y reintenta la llamada administrativa cuando el token necesita renovación.",
  requireUser: "Exige una sesión válida antes de ejecutar una operación del sistema.",
  assertRole: "Comprueba que el rol actual esté autorizado; Administrador conserva acceso total.",
  audit: "Registra en la bitácora quién realizó una acción, sobre qué entidad y con qué detalle.",
  correctStoredSpelling: "Aplica una corrección ortográfica única a registros anteriores y deja evidencia en la bitácora.",
  errorResponse: "Convierte errores internos conocidos en respuestas HTTP y mensajes comprensibles.",
  GET: "Manejador HTTP de lectura: reúne inventario, pedidos, facturas, cobros, catálogos, entregas y permisos para la interfaz.",
  POST: "Manejador HTTP de escritura: valida el rol y dirige cada acción a su bloque transaccional correspondiente.",
  AuthShell: "Componente raíz de acceso que decide entre carga, inicio de sesión, cambio obligatorio de contraseña o sistema.",
  LoginScreen: "Componente del formulario de inicio de sesión.",
  PasswordChange: "Componente para establecer la primera contraseña personal.",
  Dashboard: "Componente principal que carga los datos, calcula alertas y presenta los módulos permitidos por el rol.",
  StatusBadge: "Muestra el estado de un pedido o factura con texto y color coherentes.",
  EmptyState: "Muestra una explicación cuando una lista o tabla no contiene registros.",
  ThemeSwitch: "Permite alternar entre modo claro y oscuro.",
  Field: "Campo de texto reutilizable conectado al estado de un formulario modal.",
  TextAreaField: "Área de texto reutilizable conectada al estado de un formulario modal.",
  ActionDialog: "Construye el contenido y las validaciones de los distintos formularios modales.",
  SelectField: "Selector reutilizable conectado al estado de un formulario modal.",
  EntryProductField: "Selecciona un producto existente o habilita la captura de uno nuevo para una entrada.",
  EntryQuantitySummary: "Calcula y explica las unidades totales que se agregarán al inventario.",
  OrderProductField: "Selecciona el producto y lote disponibles para un pedido.",
  OrderQuantitySummary: "Convierte cajas y unidades sueltas al total que descontará el pedido.",
  InvoiceOrderField: "Relaciona una factura con un pedido pendiente y completa sus datos principales.",
  CustomerCatalogField: "Selecciona un cliente frecuente y puede copiar dirección o RFC al formulario.",
  printInvoice: "Abre una versión imprimible del comprobante seleccionado.",
  exportMovements: "Exporta la bitácora visible como CSV compatible con Excel.",
  BulkCashOutflow: "Componente que captura varias partidas y las envía como una sola salida de dinero.",
  SupplierReceipts: "Componente que agrupa pedidos por proveedor y valida su recepción física.",
  ThemeProvider: "Conecta next-themes con toda la aplicación y evita parpadeos al cargar el tema.",
  Home: "Renderiza la página principal y delega el acceso a AuthShell.",
  RootLayout: "Envuelve todas las páginas con idioma, estilos y tema global.",
  createCollectionHistoryWorkbook: "Construye en memoria el libro Excel con movimientos, totales y desgloses.",
  downloadCollectionHistoryExcel: "Genera el libro y dispara su descarga desde el navegador.",
  cn: "Combina clases CSS condicionales y resuelve conflictos de Tailwind.",
  useIsMobile: "Observa el ancho de la ventana y devuelve si corresponde al diseño móvil.",
  exists: "Comprueba si una ruta existe sin ocultar errores distintos a archivo inexistente.",
  sites: "Crea el plugin de Vite que empaqueta metadatos y migraciones para Sites.",
  readCssTree: "Lee recursivamente los estilos usados por las pruebas de componentes.",
};

const tableDescriptions = {
  appUsers: "Cuentas operativas, roles y vínculo con la identidad de Supabase.",
  authSessions: "Sesiones locales, tokens de Supabase y fecha de vencimiento.",
  customers: "Directorio de clientes frecuentes.",
  suppliers: "Directorio de proveedores.",
  products: "Catálogo único de productos, mínimos y unidades por caja.",
  stockLots: "Existencias separadas por producto, proveedor, lote y caducidad.",
  orders: "Encabezados de pedidos a clientes.",
  orderItems: "Partidas y presentación capturada en cada pedido.",
  orderReturns: "Devoluciones parciales o totales de partidas vendidas.",
  orderReschedules: "Historial de cambios obligatorios de fecha de entrega.",
  invoices: "Facturas o comprobantes relacionados con pedidos y clientes.",
  shipmentReviews: "Aprobaciones de Calidad previas al surtido.",
  shipmentReviewLots: "Lotes y cantidades elegidos por FEFO para cada revisión.",
  drivers: "Catálogo de choferes activos o inactivos.",
  deliveries: "Programación y seguimiento de entregas.",
  payments: "Cobros aplicados a las facturas.",
  cashOutflows: "Salidas de dinero y sus partidas de compra.",
  movements: "Bitácora inmutable de acciones de los usuarios.",
};

/** Devuelve una descripción específica o una explicación basada en la carpeta del archivo. */
function describeFile(file) {
  if (fileDescriptions[file]) return fileDescriptions[file];
  if (file.startsWith("components/ui/")) {
    const primitive = file.split("/").at(-1).replace(/\.tsx$/, "");
    return `Primitiva reutilizable de interfaz “${primitive}”; encapsula estructura, accesibilidad y estilos compartidos.`;
  }
  return "Archivo fuente del sistema Reyes Barreda; consulta docs/FILE_GUIDE.md para conocer su lugar dentro de la arquitectura.";
}

/** Produce una explicación breve para una función o componente detectado. */
function describeFunction(name) {
  if (functionDescriptions[name]) return functionDescriptions[name];
  if (/^[A-Z]/.test(name)) return `Componente React reutilizable \`${name}\`; recibe propiedades tipadas y renderiza su parte de la interfaz.`;
  if (name.startsWith("use")) return `Hook React \`${name}\` que encapsula estado o comportamiento reutilizable.`;
  return `Función auxiliar \`${name}\`; encapsula esta operación para mantener el módulo pequeño y reutilizable.`;
}

/** Inserta JSDoc antes de declaraciones superiores sin tocar su código ejecutable. */
function documentFunctions(source) {
  const lines = source.split("\n");
  const output = [];
  for (const line of lines) {
    const declaration = line.match(/^(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/);
    const arrow = line.match(/^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=.*=>/);
    const table = line.match(/^export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*sqliteTable/);
    const name = declaration?.[1] || arrow?.[1];
    const previous = [...output].reverse().find((item) => item.trim()) || "";
    if (table && tableDescriptions[table[1]] && !previous.trim().endsWith("*/")) {
      output.push(`/** Tabla \`${table[1]}\`: ${tableDescriptions[table[1]]} */`);
    } else if (name && !previous.trim().endsWith("*/") && !previous.trim().startsWith("//")) {
      output.push(`/** ${describeFunction(name)} */`);
    }
    output.push(line);
  }
  return output.join("\n");
}

/** Recorre carpetas sin seguir dependencias ni salidas generadas. */
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (["node_modules", "dist", ".git", ".next", ".sites-runtime", ".wrangler"].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

/** Documenta formatos que aceptan comentarios y deja intactos JSON, imágenes y hojas de cálculo. */
async function documentFile(path) {
  const file = relative(root, path).replaceAll("\\", "/");
  const extension = extname(file);
  if (![".ts", ".tsx", ".mjs", ".css", ".sql", ".sh", ".svg"].includes(extension) && ![".gitignore", ".npmrc"].includes(file)) return;
  let source = await readFile(path, "utf8");
  if (source.includes("@file ")) return;

  if ([".ts", ".tsx", ".mjs"].includes(extension)) {
    source = `/**\n * @file ${describeFile(file)}\n *\n * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.\n */\n${documentFunctions(source)}`;
  } else if (extension === ".css") {
    source = `/* @file Hoja global: tokens de color, estilos de acceso, paneles, tablas, formularios y adaptación móvil. */\n${source}`;
  } else if (extension === ".sql") {
    source = `-- @file Migración generada de Cloudflare D1/SQLite. Mantén el orden numérico y no edites migraciones ya aplicadas.\n${source}`;
  } else if (extension === ".sh") {
    const lines = source.split("\n");
    lines.splice(lines[0].startsWith("#!") ? 1 : 0, 0, `# @file Script de soporte del proyecto. Su propósito detallado está documentado en docs/FILE_GUIDE.md.`);
    source = lines.join("\n");
  } else if (extension === ".svg") {
    source = `<!-- @file Icono vectorial del sistema. -->\n${source}`;
  } else {
    source = `# @file Configuración del proyecto; consulta docs/FILE_GUIDE.md antes de cambiarla.\n${source}`;
  }
  await writeFile(path, source);
}

for (const file of await walk(root)) await documentFile(file);

