/**
 * @file Esquema Drizzle de todas las tablas, relaciones, índices y valores predeterminados almacenados en Cloudflare D1.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/** Tabla `appUsers`: Cuentas operativas, roles y vínculo con la identidad de Supabase. */
export const appUsers = sqliteTable("app_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(), displayName: text("display_name").notNull(),
  username: text("username").notNull().default(""), authUserId: text("auth_user_id"),
  role: text("role").notNull(), active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  uniqueIndex("idx_app_users_email").on(t.email),
  uniqueIndex("idx_app_users_username").on(t.username).where(sql`${t.username} <> ''`),
  uniqueIndex("idx_app_users_auth_user_id").on(t.authUserId).where(sql`${t.authUserId} IS NOT NULL`),
]);

/** Tabla `authSessions`: Sesiones locales, tokens de Supabase y fecha de vencimiento. */
export const authSessions = sqliteTable("auth_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tokenHash: text("token_hash").notNull(),
  appUserId: integer("app_user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }),
  authUserId: text("auth_user_id").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  uniqueIndex("idx_auth_sessions_token_hash").on(t.tokenHash),
  index("idx_auth_sessions_app_user").on(t.appUserId),
  index("idx_auth_sessions_expiry").on(t.expiresAt),
]);

/** Tabla `customers`: Directorio de clientes frecuentes. */
export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(), rfc: text("rfc").notNull().default(""),
  phone: text("phone").notNull().default(""), email: text("email").notNull().default(""),
  address: text("address").notNull().default(""), active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("idx_customers_name").on(t.name)]);

/** Tabla `suppliers`: Directorio de proveedores. */
export const suppliers = sqliteTable("suppliers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(), rfc: text("rfc").notNull().default(""),
  contactName: text("contact_name").notNull().default(""), phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""), active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("idx_suppliers_name").on(t.name)]);

/** Tabla `products`: Catálogo único de productos, mínimos y unidades por caja. */
export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }), code: text("code").notNull(),
  name: text("name").notNull(), minimumStock: integer("minimum_stock").notNull().default(10),
  unitsPerBox: integer("units_per_box").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [uniqueIndex("idx_products_code").on(t.code)]);

/** Tabla `stockLots`: Existencias separadas por producto, proveedor, lote y caducidad. */
export const stockLots = sqliteTable("stock_lots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id), supplierId: integer("supplier_id").references(() => suppliers.id), lot: text("lot").notNull(),
  expiryDate: text("expiry_date").notNull(), quantity: integer("quantity").notNull().default(0),
  netPriceCents: integer("net_price_cents").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [uniqueIndex("idx_stock_lots_product_lot").on(t.productId, t.lot), index("idx_stock_lots_expiry").on(t.expiryDate)]);

/** Tabla `orders`: Encabezados de pedidos a clientes. */
export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }), folio: text("folio").notNull(),
  customerId: integer("customer_id").references(() => customers.id), customer: text("customer").notNull(), status: text("status").notNull().default("PENDIENTE"),
  notes: text("notes").notNull().default(""), deliveryDate: text("delivery_date"),
  deliveryZone: text("delivery_zone"), deliveryLocation: text("delivery_location"), createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), completedAt: text("completed_at"),
}, (t) => [uniqueIndex("idx_orders_folio").on(t.folio), index("idx_orders_status").on(t.status)]);

/** Tabla `orderItems`: Partidas y presentación capturada en cada pedido. */
export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }), orderId: integer("order_id").notNull().references(() => orders.id),
  lotId: integer("lot_id").notNull().references(() => stockLots.id), quantity: integer("quantity").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(), orderedBoxes: integer("ordered_boxes").notNull().default(0),
  orderedUnits: integer("ordered_units").notNull().default(0), unitsPerBox: integer("units_per_box").notNull().default(1),
}, (t) => [index("idx_order_items_order").on(t.orderId)]);

/** Tabla `orderReturns`: Devoluciones parciales o totales de partidas vendidas. */
export const orderReturns = sqliteTable("order_returns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull().references(() => orders.id),
  orderItemId: integer("order_item_id").notNull().references(() => orderItems.id),
  lotId: integer("lot_id"),
  quantity: integer("quantity").notNull(),
  reason: text("reason").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("idx_order_returns_order_item").on(t.orderId, t.orderItemId)]);

/** Tabla `orderReschedules`: Historial de cambios obligatorios de fecha de entrega. */
export const orderReschedules = sqliteTable("order_reschedules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull().references(() => orders.id),
  previousDate: text("previous_date").notNull(), newDate: text("new_date").notNull(),
  reason: text("reason").notNull(), createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("idx_order_reschedules_order").on(t.orderId)]);

/** Tabla `invoices`: Facturas o comprobantes relacionados con pedidos y clientes. */
export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }), folio: text("folio").notNull(),
  orderId: integer("order_id").references(() => orders.id), customerId: integer("customer_id").references(() => customers.id), kind: text("kind").notNull(),
  customer: text("customer").notNull(), rfc: text("rfc").notNull().default(""),
  amountCents: integer("amount_cents").notNull(), status: text("status").notNull(), cfdiUuid: text("cfdi_uuid"),
  scheduledSendDate: text("scheduled_send_date"), sendDelayReason: text("send_delay_reason").notNull().default(""), sentAt: text("sent_at"),
  createdBy: text("created_by").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [uniqueIndex("idx_invoices_folio").on(t.folio)]);

/** Tabla `shipmentReviews`: Aprobaciones de Calidad previas al surtido. */
export const shipmentReviews = sqliteTable("shipment_reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull().references(() => orders.id),
  notes: text("notes").notNull().default(""), reviewedBy: text("reviewed_by").notNull(),
  reviewedAt: text("reviewed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [uniqueIndex("idx_shipment_reviews_order").on(t.orderId)]);

/** Tabla `shipmentReviewLots`: Lotes y cantidades elegidos por FEFO para cada revisión. */
export const shipmentReviewLots = sqliteTable("shipment_review_lots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reviewId: integer("review_id").notNull().references(() => shipmentReviews.id),
  orderItemId: integer("order_item_id").notNull().references(() => orderItems.id),
  lotId: integer("lot_id").notNull().references(() => stockLots.id),
  quantity: integer("quantity").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("idx_shipment_review_lots_review").on(t.reviewId), uniqueIndex("idx_shipment_review_lots_review_lot").on(t.reviewId, t.lotId)]);

/** Tabla `drivers`: Catálogo de choferes activos o inactivos. */
export const drivers = sqliteTable("drivers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(), active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [uniqueIndex("idx_drivers_name").on(t.name)]);

/** Tabla `deliveries`: Programación y seguimiento de entregas. */
export const deliveries = sqliteTable("deliveries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").references(() => orders.id),
  driverId: integer("driver_id").notNull().references(() => drivers.id),
  customer: text("customer").notNull(), invoiceNumber: text("invoice_number").notNull(),
  contents: text("contents").notNull(), deliveryDate: text("delivery_date").notNull(),
  createdBy: text("created_by").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("idx_deliveries_date").on(t.deliveryDate), index("idx_deliveries_driver").on(t.driverId)]);

/** Tabla `payments`: Cobros aplicados a las facturas. */
export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }), invoiceId: integer("invoice_id").notNull().references(() => invoices.id),
  amountCents: integer("amount_cents").notNull(), method: text("method").notNull(), reference: text("reference").notNull().default(""),
  paymentCondition: text("payment_condition").notNull().default("SIN_ESPECIFICAR"),
  collectionChannel: text("collection_channel").notNull().default(""), comments: text("comments").notNull().default(""),
  receivedBy: text("received_by").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("idx_payments_invoice").on(t.invoiceId)]);

/** Tabla `cashOutflows`: Salidas de dinero y sus partidas de compra. */
export const cashOutflows = sqliteTable("cash_outflows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  beneficiary: text("beneficiary").notNull(), concept: text("concept").notNull(),
  amountCents: integer("amount_cents").notNull(), method: text("method").notNull(),
  reference: text("reference").notNull().default(""), movementDate: text("movement_date").notNull(),
  itemsJson: text("items_json").notNull().default("[]"), notes: text("notes").notNull().default(""),
  requiresInvoiceValidation: integer("requires_invoice_validation", { mode: "boolean" }).notNull().default(false),
  invoiceNumber: text("invoice_number").notNull().default(""), validationNotes: text("validation_notes").notNull().default(""),
  invoiceValidatedBy: text("invoice_validated_by").notNull().default(""), invoiceValidatedAt: text("invoice_validated_at"),
  createdBy: text("created_by").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index("idx_cash_outflows_date").on(t.movementDate),
  index("idx_cash_outflows_invoice_validation").on(t.requiresInvoiceValidation, t.invoiceValidatedAt),
  uniqueIndex("idx_cash_outflows_supplier_invoice").on(t.supplierId, t.invoiceNumber).where(sql`${t.invoiceNumber} <> ''`),
]);

/** Tabla `movements`: Bitácora inmutable de acciones de los usuarios. */
export const movements = sqliteTable("movements", {
  id: integer("id").primaryKey({ autoIncrement: true }), action: text("action").notNull(), entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"), quantity: integer("quantity"), details: text("details").notNull().default(""),
  actorEmail: text("actor_email").notNull(), actorName: text("actor_name").notNull(), actorRole: text("actor_role").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("idx_movements_created_at").on(t.createdAt)]);
