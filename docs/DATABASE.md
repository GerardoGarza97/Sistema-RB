# Base de datos

La fuente del esquema es `db/schema.ts`. Las migraciones numeradas se aplican en orden y no deben reescribirse después de llegar a producción.

| Tabla | Contenido principal |
|---|---|
| `app_users` | Cuenta operativa, usuario, correo, rol, estado y vínculo con Supabase. |
| `auth_sessions` | Hash de sesión, tokens de Supabase y vencimiento. |
| `customers` | Clientes frecuentes y datos de contacto. |
| `suppliers` | Proveedores y datos de contacto. |
| `products` | Código, nombre, mínimo y unidades por caja. |
| `stock_lots` | Cantidad, lote, caducidad, proveedor y precio neto. |
| `orders` | Encabezado, cliente, estado, fecha y zona de entrega. |
| `order_items` | Productos, cantidades, cajas, unidades y precio del pedido. |
| `order_returns` | Cantidades devueltas y motivo. |
| `order_reschedules` | Fecha anterior, nueva fecha y motivo del retraso. |
| `invoices` | Factura, cliente, importe, estado y seguimiento de envío. |
| `payments` | Cobros, método, condición, canal y responsable. |
| `shipment_reviews` | Revisión de Calidad de un pedido pagado. |
| `shipment_review_lots` | Lotes FEFO y cantidades aprobadas. |
| `drivers` | Choferes disponibles. |
| `deliveries` | Pedido, chofer, factura, contenido y fecha. |
| `cash_outflows` | Salidas de dinero, proveedor, partidas y factura recibida. |
| `movements` | Bitácora de acciones con cuenta, rol, fecha y detalle. |

## Cantidades y dinero

- El inventario se almacena siempre en unidades enteras.
- `units_per_box` permite convertir cajas a unidades.
- Los importes se guardan en centavos para evitar errores de punto flotante.
- Un pedido conserva las cajas, unidades sueltas y unidades por caja capturadas en ese momento; cambiar la presentación del producto no altera pedidos antiguos.

## Cómo cambiar el esquema

1. Modifica `db/schema.ts`.
2. Ejecuta `npm run db:generate`.
3. Revisa el nuevo `.sql`; nunca debe borrar datos por accidente.
4. Compila y prueba.
5. Publica la migración junto con el mismo código que la necesita.

