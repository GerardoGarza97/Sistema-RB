# Guía para modificar el sistema

## Antes de editar

1. Crea una rama: `git switch -c cambio/descripcion-corta`.
2. Haz un cambio pequeño y relacionado.
3. Ejecuta `npm run build`.
4. Si cambiaste tablas, genera y revisa la migración.
5. Confirma que los permisos se validen también en la API, no solo ocultando botones.

## Cambios comunes

| Quiero cambiar… | Archivo principal | También revisar |
|---|---|---|
| Un texto, botón o pantalla | `app/dashboard.tsx` | `app/globals.css` |
| El diseño móvil | `app/globals.css` | `components/ui/sidebar.tsx` |
| Los apartados de un rol | `navItems` en `app/dashboard.tsx` | `assertRole()` en la acción de API |
| Una regla de inventario | `app/api/system/route.ts` | `db/schema.ts` y pruebas |
| El flujo de pedidos | `CREATE_ORDER`, `UPDATE_ORDER`, `REVIEW_ORDER_FEFO`, `DISPATCH_ORDER` | Tablas `orders`, `order_items` y revisiones |
| La plantilla de Excel | `public/plantilla-inventario-reyes-barreda.xlsx` | `importExcel()` en `dashboard.tsx` |
| El Excel de cobranza | `lib/cobranza-excel.ts` | Tipos `CollectionHistoryRow` |
| Cuentas y contraseñas | `app/supabase-auth.ts` | Rutas `app/api/auth/` y función Edge |
| Una tabla o columna | `db/schema.ts` | Nueva migración Drizzle |

## Cómo añadir una operación

1. Añade el formulario o botón en la pantalla correspondiente.
2. Envía una `action` descriptiva mediante `post()`.
3. Crea un bloque en `POST` de `/api/system`.
4. Valida el rol con `assertRole()`.
5. Limpia y valida todos los datos recibidos.
6. Usa transacción o `db.batch()` si varias escrituras deben completarse juntas.
7. Llama a `audit()`.
8. Devuelve un mensaje claro.

## Reglas que no conviene romper

- Los productos sin precio no deben venderse como $0.00.
- Un pedido solo puede surtirse después del pago y de la revisión FEFO.
- El inventario no puede quedar negativo.
- Una factura no puede recibir cobros superiores a su saldo.
- Un vendedor solo modifica sus pedidos pendientes.
- Calidad captura lote, caducidad y factura al validar la recepción.
- Las cuentas se eliminan sin borrar su historial operativo.

